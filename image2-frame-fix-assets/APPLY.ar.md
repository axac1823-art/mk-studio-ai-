# تطبيق إصلاح إطار Image2 على جهازك

كل ما يلزم موجود في هذا المجلد:

| الملف | الوصف |
|---|---|
| `image2-frame-fix.patch` | الترقيع الكامل (5 ملفات معدّلة) — **يُطبّق من جذر المستودع** |
| `image2-frame-fix-assets/test_image2_frame_delivery.py` | نسخ إلى `worker/tests/` |
| `image2-frame-fix-assets/diagnose_image2_frames.py` | نسخ إلى `worker/scripts/` |

الـpatch مُختبر: طُبّق على `0e152d4` (رأس `codex`) من نسخة نظيفة ثم نجحت الاختبارات (27 passed).

---

## 1. التحضير

```bash
cd <مسار-مشروعك>            # جذر المستودع (حيث يوجد web/ و worker/)
git status                   # يجب أن يكون نظيفًا
git checkout codex           # أو الفرع الذي تشغّله فعليًا
git rev-parse --short HEAD   # المطلوب 0e152d4 أو أحدث
```

> إذا لم يكن `0e152d4` هو رأسك، جرّب أولًا `git apply --check` في الخطوة 2؛ إن فشل، استخدم الطريقة البديلة (§5).

## 2. تطبيق الترقيع

```bash
git apply --check ../image2-frame-fix.patch   # فحص بدون تعديل
git apply ../image2-frame-fix.patch
git status --short
```

المتوقع:
```
 M web/app/api/generate/route.ts
 M web/components/studio/image2-workspace.tsx
 M worker/catalog.py
 M worker/frame_ratio.py
 M worker/workflows/image_render.py
```

بديل يعمل حتى مع اختلاف بسيط في السياق (لا يُنشئ commit):
```bash
git apply -3 ../image2-frame-fix.patch        # دمج ثلاثي عند التعارض
# أو
patch -p1 < ../image2-frame-fix.patch
```

## 3. نسخ الاختبار وسكربت التشخيص

```bash
mkdir -p worker/scripts
cp ../image2-frame-fix-assets/test_image2_frame_delivery.py worker/tests/
cp ../image2-frame-fix-assets/diagnose_image2_frames.py   worker/scripts/
```

## 4. التحقق

```bash
cd worker
python -m pytest tests/test_image2_frame_delivery.py -q   # المتوقع: 27 passed
cd ..
python worker/scripts/diagnose_image2_frames.py           # تقرير: ما يُرسل لكل إطار
```

في تقرير التشخيص يجب أن ترى لكل إطار `OK` في سطر `GPT Image 2` و`FLUX`، وأن سطر `Magic Hour 16:9` صار `ACCEPTED`.

ثم:
```bash
cd web && npm run build      # تأكيد أن تعديل TypeScript سليم
```

## 5. إن فشل `git apply`

الملفات المعدّلة خمسة فقط؛ يمكنك تعديلها يدويًا باتباع الـpatch (كل قطعة صغيرة وموثّقة بتعليق):

1. **`worker/catalog.py`** — استبدل جسم `openai_text_to_image_input` وأضف `GPT_IMAGE_SIZES` قبله (المقاسات: `1280x720`, `720x1280`, `1248x832`, `832x1248`, `1680x720`, `1024x768`, `768x1024`, `1024x1024`).
2. **`worker/frame_ratio.py`** — `FRAME_TOLERANCE = 0.08`، وأضف `crop_to_frame()`، واستبدل `validate_image_output_frame` بالنسخة الجديدة.
3. **`worker/workflows/image_render.py`** — استيراد `crop_to_frame`، حذف `_crop_stored_image_to_ratio`، وإضافة كتلة `requested_frame` + `crop_to_frame(path, requested_frame)` قبل `insert_asset`.
4. **`web/components/studio/image2-workspace.tsx`** — أضف `useEffect` الذي يُعيد ضبط `aspectRatio` بعد effect الخاص بـ`availableResolutions`.
5. **`web/app/api/generate/route.ts`** — استبدل كتلة `rawAspect`/`aspectRatio` بالنسخة التي ترفض الإطار المجهول بـ400.

## 6. التراجع

```bash
git checkout -- web/app/api/generate/route.ts web/components/studio/image2-workspace.tsx \
                worker/catalog.py worker/frame_ratio.py worker/workflows/image_render.py
rm -f worker/tests/test_image2_frame_delivery.py worker/scripts/diagnose_image2_frames.py
```

أو إن أنشأت commit: `git revert <sha>`.

## 7. بديل: أخذ التعديل من الفرع مباشرة

```bash
git fetch origin arena/9e96fba3-mk-studio-ai
git cherry-pick cf4f8a6        # commit واحد فقط يحتوي الإصلاح
```

---

## ملاحظات بعد التطبيق

- لا حاجة لإعادة تشغيل أي migration؛ لا تغيير في قاعدة البيانات.
- أعد تشغيل الـworker (والـweb) لالتقاط التعديلات.
- ما زالت الدقة 2K/4K غير مدعومة (كل النماذج على 1K) — هذا خارج نطاق هذا الإصلاح.
