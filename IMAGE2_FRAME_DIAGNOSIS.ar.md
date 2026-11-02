# تشخيص: لماذا لا يستطيع Image2 (`/app/image2`) إنتاج صورة بإطار مختلف؟

مراجعة GitHub + تحليل commit `8c4ac3b` + مقارنة مع الكود الحالي في فرع `codex` (`0e152d4`).
تاريخ المراجعة: 2026-11-02 — الفرع الحالي: `arena/9e96fba3-mk-studio-ai`.

---

## 1. حالة GitHub

| العنصر | الحالة |
|---|---|
| `origin/main` | `e410b3b` (2026-10-08) — متأخر جدًا |
| `origin/codex` | `0e152d4` "Sync current CODEX work" (2026-11-02) — **هو الكود الحالي** |
| `8c4ac3b` | "Sync current work to CODEX" (2026-10-28) — **commit معلّق (orphan)** |
| فروع تحتوي `8c4ac3b` | **لا شيء**. أصلُه `bad4e555` = رأس فرع `image2-classic`، لكنه لم يُدمج ولا يُدفع به إلى أي فرع |
| Pull requests | 3 مغلقة (#3، #2، #1) — لا مفتوح |
| `main...codex` | 84 commit متقدّم، 269 ملف |

**الخلاصة المهمة:** `8c4ac3b` **ليس** الكود الذي يعمل عندك. هو نسخة "إطار (frame)" كاملة كُتبت في 28 أكتوبر ثم أُعيدت كتابتها بشكل أبسط في `0e152d4` (فرع codex، 2 نوفمبر)، وفقدت معظم منطق الإطار. لذلك أي إصلاح يُبنى على افتراض أن `8c4ac3b` هو الحالي سيكون خاطئًا.

### ما الذي احتواه `8c4ac3b` وخسره الكود الحالي

| في `8c4ac3b` | في الكود الحالي (`0e152d4`) |
|---|---|
| `worker/frame_ratio.py` = 214 سطرًا: مصفوفة `resolution_ratios` لكل نموذج، `GPT_IMAGE_SIZES_BY_RESOLUTION` (1K/2K/4K)، `filter_by_resolution`، `filter_by_frame`، `check_delivered_ratio` بتسامح **7%**، `check_delivered_resolution` | `worker/frame_ratio.py` = 78 سطرًا: `filter_candidates_by_frame` + `validate_image_output_frame` بتسامح **2.5%** فقط |
| `_stage_text_to_image_outputs` (تحميل + تحقّق قبل اعتماد النموذج الفائز) | حُذف؛ التحقّق يحدث على URLs قبل التخزين |
| مقاسات GPT Image 2.5 معرّفة ومصفوفة لكل دقة | أرقام مكتوبة يدويًا وخاطئة (انظر §3) |
| قائمة `frame_ratios` لكل نموذج | `IMAGE2_FRAME_RATIOS` واحدة تُنسخ لكل النماذج (مبالغة في القدرات) |

---

## 2. مسار الإطار (frame) في الكود الحالي

```
UI  web/components/studio/image2-workspace.tsx
    ├─ IMAGE2_ASPECT_RATIOS (auto,1:1,16:9,9:16,4:3,3:4,3:2,2:3,21:9)
    ├─ availableAspectRatios = تصفية حسب frameRatios للنماذج المُهيّأة
    ├─ canGenerate = ... && selectedModelCanHandleFrame
    └─ form.append("aspectRatio", aspectRatio)
            ↓
API web/app/api/generate/route.ts:335  →  job.input.aspectRatio
            ↓
Worker worker/workflows/image_render.py
    ├─ feature_candidates: تصفية بعدد المرجعيات + النموذج
    ├─ filter_candidates_by_frame(...)            (frame_ratio.py:45)
    ├─ order_candidates(...)   ← يُعيد النموذج المختار فقط إن اختار المستخدم نموذجًا
    ├─ output_validator = validate_image_output_frame(...)  (frame_ratio.py:81)
    └─ store_output() → insert_asset()
            ↓
Adapters worker/catalog.py: bfl / openai / google / magichour
```

نقطة الفشل الحقيقية في ثلاث حلقات: **ما يُرسل إلى المزوّد**، **قبول مخرجات المزوّد**، و**عدم وجود تصحيح نهائي للإطار**.

---

## 3. الأسباب الجذرية (بدليل قابل للتشغيل)

سكربت التشخيص الجديد `worker/scripts/diagnose_image2_frames.py` يشغّل نفس كود الإنتاج بدون أي استدعاء شبكي:

```
python worker/scripts/diagnose_image2_frames.py
```

### السبب ① — مقاسات OpenAI غير صالحة ⇒ المزوّد يرفض 5 إطارات من 8

قاعدة `gpt-image-2` الموثّقة: كل ضلع من مضاعفات 16، النسبة بين 1:3 و3:1، مجموع البكسلات بين **655,360** و**8,294,400**.

| الإطار | المقاس القديم | البكسلات | الحكم |
|---|---|---|---|
| 16:9 | 1024x576 | 589,824 | ❌ أقل من الحد الأدنى |
| 9:16 | 576x1024 | 589,824 | ❌ |
| 3:2 | 960x640 | 614,400 | ❌ |
| 2:3 | 640x960 | 614,400 | ❌ |
| 21:9 | 1008x432 | 435,456 | ❌ + 1008 غير قابل للقسمة على 16 |
| 1:1 / 4:3 / 3:4 | 1024x1024 / 1024x768 / 768x1024 | ضمن الحدود | ✅ |

النتيجة: `POST /v1/images/generations` يرجع 400، والاستثناء يبتلعه `execute_with_fallback`؛ فإذا كان النموذج مختارًا يدويًا (`order_candidates` يُعيد نموذجًا واحدًا فقط) لا يوجد بديل ⇒ **المهمة تفشل كاملة**. ولهذا تحديدًا الإطار الافتراضي 4:3 يعمل وباقي الإطارات لا تعمل.

### السبب ② — عتبة التحقّق 2.5% ترفض إطارات المزوّدين الموثّقة

| الخرج الحقيقي | المطلوب | الانحراف | 2.5% (قديم) | 8% (جديد) |
|---|---|---|---|---|
| Magic Hour 640x384 | 16:9 | 6.25% | ❌ مرفوض | ✅ |
| Magic Hour 384x640 | 9:16 | 6.67% | ❌ مرفوض | ✅ |
| Gemini 1K 1584x672 | 21:9 | 1.02% | ✅ | ✅ |
| Gemini 2.5 1536x672 | 21:9 | 2.04% | ✅ (بالحافة) | ✅ |
| 3:2 عرضًا مقابل 16:9 | 16:9 | 15.6% | ❌ | ❌ (صحيح) |

`8c4ac3b` نفسه كان يشرح في تعليقه أن Magic Hour يعيد 640x384 لـ16:9 (≈6.25%) وأن التسامح 7% مطلوب؛ لكن إعادة الكتابة خفّضته إلى 2.5% ⇒ كل مخرجات Magic Hour غير المربّعة تُرفض.

### السبب ③ — لا يوجد تصحيح نهائي للإطار (وظيفة ميتة)

`_crop_stored_image_to_ratio` كانت **مُعرّفة وغير مُستدعاة أبدًا** في `image_render.py`، وتدعم 5 إطارات فقط. أي انحراف صغير لم يكن له مسار تصحيح: إما أن يُرفض الطلب أو تُحفظ صورة بإطار مختلف عمّا اختاره المستخدم.

### السبب ④ — المبالغة في القدرات (capability over-claim)

`catalog.py:661` يعرّف `IMAGE2_FRAME_RATIOS` = كل الإطارات الثمانية ويمنحها **لكل** النماذج، بينما الواقع:

* Magic Hour Flux 2 Klein: فقط `1:1, 16:9, 9:16` (مضبوط بشكل صحيح).
* OpenAI: حسب القيود أعلاه.
* Google: يمرّر `imageConfig.aspectRatio` — الثمانية مدعومة فعلًا.
* BFL: `width/height` من مضاعفات 32 و256–1440 — القيم الحالية صحيحة.

لذلك تُفعّل الواجهة إطارات لا يستطيع النموذج تسليمها، ثم يفشل الطلب عند الحدود.

### السبب ⑤ — الواجهة تُبقي إطارًا غير مدعوم ولا تُعيد التوليد

`availableAspectRatios` تُحسب من النماذج المُهيّأة، لكن **لا يوجد effect يُعيد ضبط `aspectRatio`** عند تغيير النموذج (بخلاف `quality` و`resolution` اللذين لهما effect). فإذا اختار المستخدم 21:9 ثم بدّل إلى Magic Hour: زر الإطار يُعطّل و`canGenerate` يصبح `false` مع تنبيه صغير فقط ⇒ إحساس بأن "الإطار لا يعمل".

### السبب ⑥ — الـ API يحوّل أي إطار غير معروف إلى 1:1 بصمت

`web/app/api/generate/route.ts:335` كان:
```ts
: ASPECT_RATIOS.includes(rawAspect) ? rawAspect : "1:1"
```
أي إطار غير موجود في القائمة يُستبدل بمربّع تلقائيًا بدل رفض الطلب — فيظهر للمستخدم أنه حصل على إطار مختلف عمّا طلب.

---

## 4. ما تم إصلاحه في هذا الفرع

| الملف | التغيير |
|---|---|
| `worker/catalog.py:405` | `GPT_IMAGE_SIZES` بمقاسات صالحة ومطابقة تمامًا للنسبة: `1280x720`, `720x1280`, `1248x832`, `832x1248`, `1680x720`, `1024x768`, `768x1024`, `1024x1024` (كل الأضلاع من مضاعفات 16 والبكسلات داخل الحد). |
| `worker/frame_ratio.py:42` | `FRAME_TOLERANCE = 0.08` موثّق (يقبل شبكات المزوّدين الموثّقة ويرفض الإطار المختلف فعلًا). |
| `worker/frame_ratio.py:117` | `crop_to_frame(storage_path, aspect_ratio)` — قصّ مركزي إلى النسبة الدقيقة، بلا تكبير ولا تمديد، لكل الإطارات الثمانية. |
| `worker/workflows/image_render.py:168-181` | استدعاء `crop_to_frame` بعد `store_output` وقبل `insert_asset`؛ حذف الدالة الميتة `_crop_stored_image_to_ratio`. |
| `web/components/studio/image2-workspace.tsx:1141` | effect يُعيد الإطار إلى أول إطار مدعوم (أو `auto`) عند تغيير النموذج بدل تعطيل التوليد. |
| `web/app/api/generate/route.ts:337` | رفض الإطار غير المعروف بـ400 بدل تحويله الصامت إلى 1:1، ومنع إطارات Image2 على الميزات الأخرى. |
| `worker/tests/test_image2_frame_delivery.py` | 27 اختبارًا: قواعد مقاسات OpenAI، قبول شبكة Magic Hour، رفض الإطار الخاطئ فعلًا، دقة القصّ، تصفية النماذج. |
| `worker/scripts/diagnose_image2_frames.py` | سكربت تشخيص دائم (بدون شبكة) يطبع ما يُرسل لكل إطار وهل يقبله المزوّد. |

التحقق:
```bash
cd worker && python -m pytest tests/test_image2_frame_delivery.py -q   # 27 passed
python worker/scripts/diagnose_image2_frames.py                        # تقرير كامل
```
ملاحظة: 7 اختبارات قديمة (`test_reference_mapping`، `test_weather_season_prompts`) تفشل **قبل** هذه التغييرات أيضًا — بقايا إعادة كتابة codex، وليست ناتجة عن هذا العمل.

---

## 5. مخاطر متبقية / توصيات

1. **الدقة (resolution) مُهمَلة بالكامل:** `resolutions` مثبّتة على `("1K",)`، وGoogle لا يمرّر `imageConfig.imageSize`، وOpenAI/BFL يعملان على ~1K ثابت. مصفوفة `GPT_IMAGE_SIZES_BY_RESOLUTION` من `8c4ac3b` غير موجودة. النتيجة: 2K/4K غير متاح، و"إطار + دقة" لا يمكن ضمانهما معًا.
2. **القدرات مبالغ فيها:** يجب أن تصبح `frame_ratios` لكل نموذج مبنية على قيود المزوّد (مثل قائمة مقاسات OpenAI أعلاه) بدلًا من ثابت عام واحد.
3. **`8c4ac3b` لم يُدمج:** يحتوي منطقًا (تصفية بالإطار + الدقة، تحقّق قبل اعتماد النموذج) أفضل من الحالي. المشكلة أنه يحمل أيضًا ملفات نسخ احتياطية و`.next-dev` داخل المستودع؛ إن أردت استرجاعه فالأفضل cherry-pick لملفات `worker/frame_ratio.py`, `worker/catalog.py`, `worker/workflows/image_render.py` فقط، لا الدمج الكامل.
4. **تنظيف المستودع:** ملفات `*.bak.image2-frame-fix` و`web/.next-dev/**` و`*.pre-image2-complete.bak` مرفوعة إلى Git؛ تزيد الضجيج وتُربك أي مراجعة مستقبلية.
5. **قياس قبل/بعد:** بعد نشر التعديل، اختبر الإطارات الثمانية على مزوّد واحد مُهيّأ؛ السكربت التشخيصي يعطي القيم المتوقّعة لكل مزوّد حتى تقارنها بالخرج الفعلي.
