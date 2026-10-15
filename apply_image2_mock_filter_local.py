from __future__ import annotations

"""Apply the Image2 text-only Style Filter integration to an existing local checkout.

Run from anywhere with:
    python apply_image2_mock_filter_local.py --repo "C:\\path\\to\\mks-ai-agregator-main (1)"

The script only edits existing project files locally. It does not contact or modify GitHub.
It validates every expected source marker before writing any files, and stores backups beside
changed files using the suffix .before-image2-style-filters.bak.
"""

import argparse
import shutil
import sys
from pathlib import Path

MAX_STYLE_FILTERS = 3

FILTERS_TS = r'''const IMAGE2_STYLE_FILTERS = [
  {
    id: "inkprint", tag: "#inkprint", label: "Ink print", category: "Illustration",
    description: "Carved ink contours, bold relief-print shapes, limited spot colors and subtle paper grain.",
    previewUrl: "https://commons.wikimedia.org/wiki/Special:FilePath/1988_linocut_on_paper_in_black_and_white_%27Abstract_still_life_2._-_cut_and_printed_by_Dutch_artist_Fons_Heijnsbroek.tif?width=420",
    sourcePage: "https://commons.wikimedia.org/wiki/File:1988_linocut_on_paper_in_black_and_white_%27Abstract_still_life_2._-_cut_and_printed_by_Dutch_artist_Fons_Heijnsbroek.tif",
  },
  {
    id: "oilpainting", tag: "#oilpainting", label: "Oil painting", category: "Illustration",
    description: "Layered pigments, visible brushwork, painterly edges and canvas texture.",
    previewUrl: "https://commons.wikimedia.org/wiki/Special:FilePath/Van_Gogh_-_Moorlandschaft.jpeg?width=420",
    sourcePage: "https://commons.wikimedia.org/wiki/File:Van_Gogh_-_Moorlandschaft.jpeg",
  },
  {
    id: "traditional-japan", tag: "#traditional-japan", label: "Traditional Japan", category: "Illustration",
    description: "Japanese woodblock-print language, clear contour lines, flat color and deliberate negative space.",
    previewUrl: "https://commons.wikimedia.org/wiki/Special:FilePath/The_Great_Wave_off_Kanagawa_-_wave.jpg?width=420",
    sourcePage: "https://commons.wikimedia.org/wiki/File:The_Great_Wave_off_Kanagawa_-_wave.jpg",
  },
  {
    id: "fantasy", tag: "#fantasy", label: "Fantasy", category: "Illustration",
    description: "Atmospheric concept-art treatment, evocative color and painterly depth without inventing new objects.",
    previewUrl: "https://commons.wikimedia.org/wiki/Special:FilePath/%27Night_898%27_fantasy_past_city_by_Midjourney.jpg?width=420",
    sourcePage: "https://commons.wikimedia.org/wiki/File:%27Night_898%27_fantasy_past_city_by_Midjourney.jpg",
  },
  {
    id: "cartoon", tag: "#cartoon", label: "Cartoon", category: "Illustration",
    description: "Clean 2D outlines, simplified silhouettes, flat color blocks and restrained cel shading.",
    previewUrl: "https://commons.wikimedia.org/wiki/Special:FilePath/Flat_Cartoon_Guy.png?width=420",
    sourcePage: "https://commons.wikimedia.org/wiki/File:Flat_Cartoon_Guy.png",
  },
  {
    id: "3d", tag: "#3d", label: "3D", category: "3D",
    description: "Dimensional forms, coherent material response, realistic shading and controlled contact shadows.",
    previewUrl: "https://commons.wikimedia.org/wiki/Special:FilePath/Architectural_render_(Blender).jpg?width=420",
    sourcePage: "https://commons.wikimedia.org/wiki/File:Architectural_render_(Blender).jpg",
  },
  {
    id: "cartoonfun", tag: "#cartoonfun", label: "Cartoon fun", category: "Illustration",
    description: "Playful rounded forms, expressive curves, lively color and energetic shape rhythm.",
    previewUrl: "https://commons.wikimedia.org/wiki/Special:FilePath/Anthropomorphic_Kazoo_Cartoon_Character_Illustration_2.png?width=420",
    sourcePage: "https://commons.wikimedia.org/wiki/File:Anthropomorphic_Kazoo_Cartoon_Character_Illustration_2.png",
  },
  {
    id: "digital-art", tag: "#digital-art", label: "Digital art", category: "Illustration",
    description: "Refined digital brushwork, controlled edges, layered color transitions and art-directed detail.",
    previewUrl: "https://commons.wikimedia.org/wiki/Special:FilePath/Digital_Art.jpg?width=420",
    sourcePage: "https://commons.wikimedia.org/wiki/File:Digital_Art.jpg",
  },
  {
    id: "comic", tag: "#comic", label: "Comic", category: "Illustration",
    description: "Confident inking, graphic shadows, selective halftone and a clear focal hierarchy.",
    previewUrl: "https://commons.wikimedia.org/wiki/Special:FilePath/Krazy_Kat_panel.jpg?width=420",
    sourcePage: "https://commons.wikimedia.org/wiki/File:Krazy_Kat_panel.jpg",
  },
  {
    id: "painting", tag: "#painting", label: "Painting", category: "Illustration",
    description: "General fine-art painting treatment with visible strokes and layered pigment, without forcing a specific medium.",
    previewUrl: "https://commons.wikimedia.org/wiki/Special:FilePath/Auguste_Renoir,_Picking_Flowers,_1875,_NGA_52205.jpg?width=420",
    sourcePage: "https://commons.wikimedia.org/wiki/File:Auguste_Renoir,_Picking_Flowers,_1875,_NGA_52205.jpg",
  },
  {
    id: "dark", tag: "#dark", label: "Dark", category: "Photo",
    description: "Low-key tonal treatment, deep shadows, restrained highlights and preserved shadow detail.",
    previewUrl: "https://commons.wikimedia.org/wiki/Special:FilePath/Buildings-nighttime.jpg?width=420",
    sourcePage: "https://commons.wikimedia.org/wiki/File:Buildings-nighttime.jpg",
  },
  {
    id: "sketch", tag: "#sketch", label: "Sketch", category: "Design",
    description: "Graphite-like strokes, varied line weight, construction marks and controlled hatching.",
    previewUrl: "https://commons.wikimedia.org/wiki/Special:FilePath/Architectural_Drawing_(recto);_Sketch_of_a_Figure_(verso)_MET_DP803151.jpg?width=420",
    sourcePage: "https://commons.wikimedia.org/wiki/File:Architectural_Drawing_(recto);_Sketch_of_a_Figure_(verso)_MET_DP803151.jpg",
  },
  {
    id: "mock", tag: "#mock", label: "Rough concept", category: "Design",
    description: "An early, deliberately unfinished concept with loose exploratory strokes, simplified masses and unresolved details.",
    previewUrl: "https://commons.wikimedia.org/wiki/Special:FilePath/Sketch_for_an_architectural_magazine_MET_DP806214.jpg?width=420",
    sourcePage: "https://commons.wikimedia.org/wiki/File:Sketch_for_an_architectural_magazine_MET_DP806214.jpg",
  },
  {
    id: "2000s-phone", tag: "#2000s-phone", label: "2000s phone", category: "Photo",
    description: "Early digital-camera character, limited dynamic range, subtle sensor noise and mild JPEG softness.",
    previewUrl: "https://commons.wikimedia.org/wiki/Special:FilePath/Digital_retro_photography_-_0.3_megapixel_camera_app.jpg?width=420",
    sourcePage: "https://commons.wikimedia.org/wiki/File:Digital_retro_photography_-_0.3_megapixel_camera_app.jpg",
  },
  {
    id: "cyberpunk", tag: "#cyberpunk", label: "Cyberpunk", category: "Illustration",
    description: "Controlled cyan-magenta palette, selective neon-like accents and cinematic contrast.",
    previewUrl: "https://commons.wikimedia.org/wiki/Special:FilePath/Cyberpunk_city_created_by_Stable_Diffusion.webp?width=420",
    sourcePage: "https://commons.wikimedia.org/wiki/File:Cyberpunk_city_created_by_Stable_Diffusion.webp",
  },
] as const;

const IMAGE2_STYLE_CATEGORIES = ["All", "Illustration", "3D", "Design", "Photo"] as const;
'''

WORKSPACE_STEPS: list[tuple[str, str, str]] = []


def replace_once(text: str, old: str, new: str, label: str) -> str:
    count = text.count(old)
    if count != 1:
        raise ValueError(f"{label}: expected exactly 1 matching block; found {count}")
    return text.replace(old, new, 1)


def replace_between(text: str, start: str, end: str, replacement: str, label: str) -> str:
    if text.count(start) != 1:
        raise ValueError(f"{label}: start marker count is {text.count(start)}")
    start_i = text.index(start)
    end_i = text.find(end, start_i + len(start))
    if end_i < 0:
        raise ValueError(f"{label}: end marker not found after start")
    return text[:start_i] + replacement + text[end_i:]


def patch_workspace(text: str) -> str:
    text = replace_once(text,
        'const MAX_REFERENCE_IMAGES = 13; // 13 content refs + 1 dedicated style ref = 14 provider image inputs max.',
        'const MAX_REFERENCE_IMAGES = 14; // Style filters are text presets and do not consume image input slots.',
        'reference capacity')
    text = replace_once(text, '  supportsStyleReference?: boolean;\n', '', 'legacy model style capability')
    text = replace_once(text, '  const styleFileInputRef = useRef<HTMLInputElement>(null);\n', '', 'style upload ref')
    text = replace_once(text,
        'const ALLOWED_IMAGE_TYPES = ["image/png", "image/jpeg", "image/webp"];\n',
        'const ALLOWED_IMAGE_TYPES = ["image/png", "image/jpeg", "image/webp"];\n\n' + FILTERS_TS,
        'inline style filter catalogue')
    text = replace_once(text,
        '  const [references, setReferences] = useState<ImageInput[]>([]);\n  const [styleReference, setStyleReference] = useState<ImageInput | null>(null);\n  const [styleNotice, setStyleNotice] = useState<string | null>(null);',
        '  const [references, setReferences] = useState<ImageInput[]>([]);\n  const [selectedStyleFilters, setSelectedStyleFilters] = useState<string[]>([]);\n  const [stylePickerOpen, setStylePickerOpen] = useState(false);\n  const [styleFilterSearch, setStyleFilterSearch] = useState("");\n  const [styleFilterCategory, setStyleFilterCategory] = useState<(typeof IMAGE2_STYLE_CATEGORIES)[number]>("All");\n  const [styleFilterNotice, setStyleFilterNotice] = useState<string | null>(null);',
        'style filter state')
    text = replace_between(text,
        '  const clearStyleReference = useCallback(() => {',
        '  const stopPolling = useCallback(() => {',
        '', 'remove style image uploader handlers')
    text = replace_between(text,
        '  const setProjectAssetAsStyle = useCallback((asset: WorkspaceAsset) => {',
        '  useEffect(() => {\n    if (!preselectedAssetId) return;',
        '', 'remove project image as style handler')
    text = replace_once(text,
        '    if (!modelPickerOpen && !zoomedImage) return;',
        '    if (!modelPickerOpen && !stylePickerOpen && !zoomedImage) return;',
        'modal keyboard effect guard')
    text = replace_once(text,
        '        setModelPickerOpen(false);\n        setZoomedImage(null);',
        '        setModelPickerOpen(false);\n        setStylePickerOpen(false);\n        setZoomedImage(null);',
        'Escape closes style picker')
    text = replace_once(text,
        '  }, [modelPickerOpen, zoomedImage]);',
        '  }, [modelPickerOpen, stylePickerOpen, zoomedImage]);',
        'modal effect dependencies')
    text = replace_once(text,
        '    let totalBytes = references.reduce((sum, reference) => sum + reference.sizeBytes, 0) + (styleReference?.sizeBytes ?? 0);',
        '    let totalBytes = references.reduce((sum, reference) => sum + reference.sizeBytes, 0);',
        'content upload size calculation')
    text = replace_once(text,
        '  }, [references, styleReference, makeObjectUrl]);',
        '  }, [references, makeObjectUrl]);',
        'content upload dependencies')
    text = replace_once(text,
        '  const imageInputCount = references.length + (styleReference ? 1 : 0);\n  const isCompatibleWithSelectedInputs = useCallback((model: Image2ModelOption) =>\n    model.configured\n    && imageInputCount <= (model.maxReferences ?? 0)\n    && (!styleReference || model.supportsStyleReference === true),\n  [imageInputCount, styleReference]);',
        '  const imageInputCount = references.length;\n  const isCompatibleWithSelectedInputs = useCallback((model: Image2ModelOption) =>\n    model.configured && imageInputCount <= (model.maxReferences ?? 0),\n  [imageInputCount]);',
        'model compatibility')
    text = replace_once(text,
        '  const selectedUploadBytes = references.reduce((sum, reference) => sum + reference.sizeBytes, 0) + (styleReference?.sizeBytes ?? 0);',
        '  const selectedUploadBytes = references.reduce((sum, reference) => sum + reference.sizeBytes, 0);',
        'upload byte total')
    text = replace_once(text,
        '    if (selectedModelOption && styleReference && !selectedModelOption.supportsStyleReference) {\n      setError(`${selectedModelOption.name} treats image inputs as images to edit, not as a separate Style guide. Choose a Style-compatible model or switch to Auto.`);\n      return;\n    }\n',
        '', 'remove model-specific style image guard')
    text = replace_once(text,
        '    if (styleReference) {\n      form.append("styleReferenceMeta", JSON.stringify({\n        source: styleReference.file ? "upload" : "asset",\n        assetId: styleReference.assetId,\n      }));\n      if (styleReference.file) form.append("styleReferenceFile", styleReference.file);\n    }',
        '    selectedStyleFilters.forEach((filterId) => form.append("styleFilter", filterId));',
        'submit text style filter IDs')
    text = replace_once(text,
        '  }, [prompt, isBusy, selectedModelOption, references, styleReference, imageInputCount, quality, aspectRatio, resolution, quantity, selectedProjectId, selectedModel, balance, stopAndPollJob]);',
        '  }, [prompt, isBusy, selectedModelOption, references, selectedStyleFilters, imageInputCount, quality, aspectRatio, resolution, quantity, selectedProjectId, selectedModel, balance, stopAndPollJob]);',
        'generation dependencies')
    text = replace_once(text,
        '  const handleModelSelection = (key: string) => {\n    setSelectedModel(key);\n    setModelPickerOpen(false);\n  };',
        '  const handleModelSelection = (key: string) => {\n    setSelectedModel(key);\n    setModelPickerOpen(false);\n  };\n\n  const toggleStyleFilter = (filterId: string) => {\n    if (selectedStyleFilters.includes(filterId)) {\n      setSelectedStyleFilters((current) => current.filter((id) => id !== filterId));\n      setStyleFilterNotice(null);\n      return;\n    }\n    if (selectedStyleFilters.length >= ' + str(MAX_STYLE_FILTERS) + ') {\n      setStyleFilterNotice("Choose up to ' + str(MAX_STYLE_FILTERS) + ' style filters at a time.");\n      return;\n    }\n    setSelectedStyleFilters((current) => [...current, filterId]);\n    setStyleFilterNotice(null);\n  };',
        'style filter toggle handler')

    # Replace the legacy image-upload panel with the Style Picker launch section.
    start = '          <section className="mt-5 space-y-2" aria-label="Dedicated style reference">'
    end = '          <section className="mt-5 space-y-2" aria-label="Image content references">'
    new_section = '''          <section className="mt-5 space-y-2" aria-label="Style filters">
            <div className="flex h-6 items-center justify-between gap-2">
              <h2 className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#91939e]">Style / Filter</h2>
              <span className="text-[9px] tabular-nums text-[#858792]">{selectedStyleFilters.length}/''' + str(MAX_STYLE_FILTERS) + '''</span>
            </div>
            <button type="button" onClick={() => setStylePickerOpen(true)} aria-haspopup="dialog" aria-expanded={stylePickerOpen} className="group flex min-h-[78px] w-full items-center gap-3 rounded-lg border border-white/[0.10] bg-[#1c1d22] p-2 text-left transition-colors hover:border-[#aaa7ff]/50 hover:bg-[#23242b] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#a09cff]">
              <span className="grid h-[62px] w-[62px] shrink-0 grid-cols-2 gap-0.5 overflow-hidden rounded-md bg-[#101114]">
                {selectedStyleFilters.length > 0 ? selectedStyleFilters.slice(0, 4).map((filterId) => {
                  const filter = IMAGE2_STYLE_FILTERS.find((item) => item.id === filterId);
                  return filter ? <img key={filter.id} src={filter.previewUrl} alt="" className="h-full w-full object-cover" loading="lazy" /> : null;
                }) : <span className="col-span-2 flex items-center justify-center text-[#aaa7ff]"><Wand2 className="h-5 w-5" /></span>}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-xs font-medium text-[#e5e5ec]">{selectedStyleFilters.length ? selectedStyleFilters.map((id) => IMAGE2_STYLE_FILTERS.find((item) => item.id === id)?.tag).filter(Boolean).join(" · ") : "Choose a visual style"}</span>
                <span className="mt-1 block text-[10px] leading-4 text-[#858893]">Style presets change the visual treatment, not the subject or background.</span>
              </span>
              <span className="shrink-0 rounded-md bg-white/[0.06] px-2.5 py-1.5 text-[10px] font-medium text-[#d8d7e2] group-hover:bg-[#aaa7ff]/15 group-hover:text-[#dad8ff]">Browse</span>
            </button>
            {selectedStyleFilters.length > 0 && <div className="flex flex-wrap gap-1.5">{selectedStyleFilters.map((filterId) => {
              const filter = IMAGE2_STYLE_FILTERS.find((item) => item.id === filterId);
              return filter ? <button key={filterId} type="button" onClick={() => toggleStyleFilter(filterId)} title={`Remove ${filter.tag}`} className="inline-flex items-center gap-1 rounded-full border border-[#aaa7ff]/30 bg-[#aaa7ff]/10 px-2 py-1 text-[9px] text-[#d0ceff] hover:bg-[#aaa7ff]/20">{filter.tag}<X className="h-2.5 w-2.5" /></button> : null;
            })}<button type="button" onClick={() => { setSelectedStyleFilters([]); setStyleFilterNotice(null); }} className="rounded-full px-2 py-1 text-[9px] text-[#858893] hover:bg-white/[0.06] hover:text-white">Clear all</button></div>}
            {styleFilterNotice && <p role="status" className="rounded-md border border-amber-300/20 bg-amber-300/[0.06] px-2.5 py-2 text-[10px] leading-4 text-amber-200">{styleFilterNotice}</p>}
          </section>

'''
    text = replace_between(text, start, end, new_section, 'replace legacy style panel')

    text = replace_once(text,
        '            <div className="flex items-center justify-between gap-2"><div className="flex items-center gap-1.5"><FolderOpen className="h-3.5 w-3.5 text-[#8b8e98]" /><h2 className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[#91939e]">From this project</h2></div><span className="text-[9px] text-[#737680]">Use as ref or style</span></div>',
        '            <div className="flex items-center justify-between gap-2"><div className="flex items-center gap-1.5"><FolderOpen className="h-3.5 w-3.5 text-[#8b8e98]" /><h2 className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[#91939e]">From this project</h2></div><span className="text-[9px] text-[#737680]">Add content references</span></div>',
        'project asset helper copy')
    text = replace_once(text,
        '                const isStyle = styleReference?.assetId === asset.id;\n',
        '', 'remove project style selected state')
    text = replace_once(text,
        '{(added || isStyle) && <span className="absolute right-1 top-1 flex h-4 w-4 items-center justify-center rounded-full bg-[#aaa7ff] text-[#17171b]">{isStyle ? <Wand2 className="h-2.5 w-2.5" /> : <Check className="h-2.5 w-2.5" />}</span>}',
        '{added && <span className="absolute right-1 top-1 flex h-4 w-4 items-center justify-center rounded-full bg-[#aaa7ff] text-[#17171b]"><Check className="h-2.5 w-2.5" /></span>}',
        'project image selection mark')
    text = replace_once(text,
        '                  <div className="grid grid-cols-2 border-t border-white/[0.06]"><button type="button" onClick={() => addProjectAssetToReferences(asset)} className="truncate px-1 py-1.5 text-[8px] text-[#bdbfc8] hover:bg-white/[0.06]">{added ? "Added" : "+ Ref"}</button><button type="button" onClick={() => setProjectAssetAsStyle(asset)} className={cn("truncate border-l border-white/[0.06] px-1 py-1.5 text-[8px]", isStyle ? "bg-[#aaa7ff]/10 text-[#c6c3ff]" : "text-[#8f91a0] hover:bg-white/[0.06]")}>{isStyle ? "Style ✓" : "Style"}</button></div>',
        '                  <div className="border-t border-white/[0.06]"><button type="button" onClick={() => addProjectAssetToReferences(asset)} className="w-full truncate px-1 py-1.5 text-[9px] text-[#bdbfc8] hover:bg-white/[0.06]">{added ? "Added" : "+ Add reference"}</button></div>',
        'project image actions')
    text = text.replace('<button type="button" onClick={() => item.assetId ? setProjectAssetAsStyle(assets.find((asset) => asset.id === item.assetId) ?? { id: item.assetId!, type: "image", url: item.url }) : setZoomedImage(item.url)} aria-label={item.assetId ? "Use as style" : "Open preview"} title={item.assetId ? "Use as style" : "Open preview"} className="flex h-6 w-6 items-center justify-center rounded-full bg-black/45 text-white backdrop-blur hover:bg-black/70"><Wand2 className="h-3 w-3" /></button>', '')
    text = text.replace('<button type="button" onClick={() => item.assetId ? setProjectAssetAsStyle(assets.find((asset) => asset.id === item.assetId) ?? { id: item.assetId!, type: "image", url: item.url }) : setZoomedImage(item.url)} className="rounded px-1.5 py-1 text-[9px] text-[#858893] hover:bg-white/[0.06] hover:text-white">{styleReference?.assetId === item.assetId && item.assetId ? "Style ✓" : "Style"}</button>', '')
    text = replace_once(text,
        '{selectedModelOption && (!selectedModelOption.configured || imageInputCount > (selectedModelOption.maxReferences ?? 0) || (styleReference && !selectedModelOption.supportsStyleReference)) && <p role="status" className="mt-2 rounded-md border border-amber-300/20 bg-amber-300/[0.06] px-2 py-1.5 text-[10px] leading-4 text-amber-200">{!selectedModelOption.configured ? `${selectedModelOption.name} is not configured on the worker.` : styleReference && !selectedModelOption.supportsStyleReference ? "This model uses images as edit/source inputs and cannot reliably apply Style separately. Choose a model marked Style-compatible or switch to Auto." : `This model supports ${selectedModelOption.maxReferences ?? 0} total image inputs, but ${imageInputCount} are selected.`}</p>}',
        '{selectedModelOption && (!selectedModelOption.configured || imageInputCount > (selectedModelOption.maxReferences ?? 0)) && <p role="status" className="mt-2 rounded-md border border-amber-300/20 bg-amber-300/[0.06] px-2 py-1.5 text-[10px] leading-4 text-amber-200">{!selectedModelOption.configured ? `${selectedModelOption.name} is not configured on the worker.` : `This model supports ${selectedModelOption.maxReferences ?? 0} content image inputs, but ${imageInputCount} are selected.`}</p>}',
        'model validation notice')
    text = text.replace('Follow the prompt and Style reference for lighting, palette, contrast and rendering treatment.', 'Respect the requested subject; selected style filters control visual treatment.')
    text = text.replace('Follow the prompt and Style reference for light, palette and mood.', 'Respect the requested subject; selected style filters control light, palette and mood.')
    text = text.replace('Match lighting, color and finish to the prompt and Style reference.', 'Match the requested subject and apply the selected style treatment.')
    text = text.replace('Your Style input is applied separately from content references.', 'Selected style filters are text presets, separate from content references.')
    text = text.replace('separate style reference and content references', 'visual style filters and content references')
    text = text.replace('Automatically pick a configured service that supports all selected input images, including Style.', 'Automatically pick a configured model that supports your content references and requested quality.')
    text = text.replace('`${maxRefs} total inputs max`', '`${maxRefs} content images max`')
    text = text.replace('{model.supportsStyleReference && <span className="rounded bg-[#aaa7ff]/10 px-1.5 py-0.5 text-[8px] text-[#c9c6ff]">Style-compatible</span>}', '')
    text = replace_once(text,
        'const supportsSelectedStyle = !styleReference || model.supportsStyleReference === true;',
        '',
        'model card compatibility')
    text = text.replace('{!supportsSelectedStyle && <span className="mt-1 block text-[9px] text-amber-200">Cannot reliably use Style as an independent aesthetic reference.</span>}', '')
    text = text.replace('{imageInputCount}/14 provider inputs', '{imageInputCount}/14 content images')
    text = text.replace('{imageInputCount}/14 input images', '{imageInputCount}/14 content images')

    # Add the real picker dialog before the existing model dialog.
    picker = r'''      {stylePickerOpen && <div className="fixed inset-0 z-[205] flex items-center justify-center bg-black/70 p-3 backdrop-blur-[2px] sm:p-6" onMouseDown={(event) => { if (event.target === event.currentTarget) setStylePickerOpen(false); }}>
        <section role="dialog" aria-modal="true" aria-labelledby="image2-style-picker-title" className="flex max-h-[min(800px,92vh)] w-full max-w-[900px] flex-col overflow-hidden rounded-2xl border border-white/[0.12] bg-[#23242a] text-[#eeeef2] shadow-2xl">
          <div className="border-b border-white/[0.08] p-4 sm:p-5">
            <div className="flex items-center justify-between gap-3"><div><h2 id="image2-style-picker-title" className="text-lg font-medium">Styles</h2><p className="mt-1 text-[11px] text-[#858893]">Choose up to 3 filters. These references are visual examples only and are never sent to the generation model.</p></div><button type="button" onClick={() => setStylePickerOpen(false)} aria-label="Close style picker" className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-[#9b9da7] hover:bg-white/[0.06] hover:text-white"><X className="h-4 w-4" /></button></div>
            <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex min-w-0 flex-wrap gap-1.5" role="group" aria-label="Filter style categories">{IMAGE2_STYLE_CATEGORIES.map((category) => <button key={category} type="button" onClick={() => setStyleFilterCategory(category)} aria-pressed={styleFilterCategory === category} className={cn("h-7 rounded-lg px-3 text-[10px] font-medium transition-colors", styleFilterCategory === category ? "bg-[#3a3b43] text-white" : "text-[#92949f] hover:bg-white/[0.05] hover:text-white")}>{category}</button>)}</div>
              <div className="relative w-full sm:max-w-[250px]"><Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[#777a85]" /><input value={styleFilterSearch} onChange={(event) => setStyleFilterSearch(event.target.value)} placeholder="Search styles…" aria-label="Search style filters" className="h-8 w-full rounded-lg border border-white/[0.09] bg-[#191a1f] pl-9 pr-3 text-xs outline-none placeholder:text-[#70727d] focus:border-[#8c88ff]" /></div>
            </div>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-5">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4" >
              {IMAGE2_STYLE_FILTERS.filter((item) => (styleFilterCategory === "All" || item.category === styleFilterCategory) && `${item.tag} ${item.label} ${item.description}`.toLowerCase().includes(styleFilterSearch.trim().toLowerCase())).map((item) => {
                const active = selectedStyleFilters.includes(item.id);
                const canAdd = active || selectedStyleFilters.length < ''' + str(MAX_STYLE_FILTERS) + r''';
                return <button key={item.id} type="button" onClick={() => toggleStyleFilter(item.id)} aria-pressed={active} title={item.description} className={cn("group relative min-w-0 overflow-hidden rounded-xl border text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#a09cff]", active ? "border-[#aaa7ff] bg-[#aaa7ff]/10" : "border-white/[0.08] bg-[#1a1b20] hover:border-white/[0.20]", !canAdd && "opacity-55")}>
                  <div className="relative aspect-square overflow-hidden bg-[#15161a]"><img src={item.previewUrl} alt={`${item.tag} style preview`} loading="lazy" className="h-full w-full object-cover transition-transform duration-200 group-hover:scale-[1.025]" /><div className="pointer-events-none absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-black/65 to-transparent" /><span className="absolute left-2 top-2 rounded-md border border-white/15 bg-black/55 px-1.5 py-1 text-[9px] font-semibold text-white backdrop-blur">{item.tag}</span><span className={cn("absolute right-2 top-2 flex h-5 w-5 items-center justify-center rounded-full border", active ? "border-[#d0ceff] bg-[#aaa7ff] text-[#17171b]" : "border-white/55 bg-black/25 text-transparent")}><Check className="h-3 w-3" /></span></div>
                  <span className="block px-2.5 pb-2.5 pt-2"><span className="block truncate text-[11px] font-medium text-[#e8e8ef]">{item.label}</span><span className="mt-1 block line-clamp-2 min-h-8 text-[9px] leading-4 text-[#858893]">{item.description}</span><span className="mt-1 block text-[8px] text-[#686b75]">Preview source: linked image source page</span></span>
                </button>;
              })}
            </div>
            {IMAGE2_STYLE_FILTERS.filter((item) => (styleFilterCategory === "All" || item.category === styleFilterCategory) && `${item.tag} ${item.label} ${item.description}`.toLowerCase().includes(styleFilterSearch.trim().toLowerCase())).length === 0 && <div className="py-12 text-center text-xs text-[#858893]">No matching styles.</div>}
          </div>
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-white/[0.08] bg-[#1b1c20] px-4 py-3"><p className="text-[10px] text-[#92949f]">{selectedStyleFilters.length}/''' + str(MAX_STYLE_FILTERS) + r''' selected</p><div className="flex items-center gap-2"><button type="button" onClick={() => { setSelectedStyleFilters([]); setStyleFilterNotice(null); }} className="h-8 rounded-lg px-3 text-[10px] text-[#9c9eaa] hover:bg-white/[0.06] hover:text-white">Clear selection</button><button type="button" onClick={() => setStylePickerOpen(false)} className="h-8 rounded-lg bg-[#f2f0ff] px-4 text-[10px] font-semibold text-[#17171b] hover:bg-white">Done</button></div></div>
        </section>
      </div>}

'''
    text = replace_once(text, '      {modelPickerOpen && <div className="fixed inset-0 z-[200]', picker + '      {modelPickerOpen && <div className="fixed inset-0 z-[200]', 'insert style picker dialog')

    # Refuse to write a partially updated or contradictory workspace.
    stale = ["styleFileInputRef", "styleReference", "styleNotice", "setProjectAssetAsStyle", "supportsStyleReference", "supportsSelectedStyle"]
    leftovers = [token for token in stale if token in text]
    if leftovers:
        raise ValueError("Legacy Style-image wiring remains in image2-workspace.tsx: " + ", ".join(leftovers))
    return text


def patch_api(text: str) -> str:
    marker = 'const ALLOWED_TYPES = ["image/png", "image/jpeg", "image/webp"];\n'
    insert = marker + '''const IMAGE2_STYLE_FILTER_IDS = new Set([
  "inkprint", "oilpainting", "traditional-japan", "fantasy", "cartoon", "3d",
  "cartoonfun", "digital-art", "comic", "painting", "dark", "sketch", "mock",
  "2000s-phone", "cyberpunk",
]);
const MAX_IMAGE2_STYLE_FILTERS = ''' + str(MAX_STYLE_FILTERS) + ''';
'''
    text = replace_once(text, marker, insert, 'API style filter allowlist')
    feature_marker = '''  if (typeof feature !== "string" || !SUPPORTED_FEATURES.includes(feature as Feature)) {
    return NextResponse.json({ error: "This feature is not available yet." }, { status: 400 });
  }

  const { dbUser: user } = await requireAuth();'''
    feature_new = '''  if (typeof feature !== "string" || !SUPPORTED_FEATURES.includes(feature as Feature)) {
    return NextResponse.json({ error: "This feature is not available yet." }, { status: 400 });
  }

  const rawStyleFilterValues = form.getAll("styleFilter");
  const validStyleFilterValues = rawStyleFilterValues.every(
    (value): value is string => typeof value === "string" && IMAGE2_STYLE_FILTER_IDS.has(value),
  );
  if (
    rawStyleFilterValues.length > MAX_IMAGE2_STYLE_FILTERS
    || !validStyleFilterValues
    || new Set(rawStyleFilterValues).size !== rawStyleFilterValues.length
    || (rawStyleFilterValues.length > 0 && feature !== "text_to_image")
  ) {
    return NextResponse.json({ error: "Invalid style filters for this image feature." }, { status: 400 });
  }
  const styleFilters = rawStyleFilterValues as string[];

  const { dbUser: user } = await requireAuth();'''
    text = replace_once(text, feature_marker, feature_new, 'API validate incoming filters')
    text = replace_once(text,
        '      sceneDetails,\n      cameraState: cameraState ?? undefined,',
        '      sceneDetails,\n      styleFilters: styleFilters.length > 0 ? styleFilters : undefined,\n      cameraState: cameraState ?? undefined,',
        'API pass style filter IDs to job input')
    return text


PROMPT_MAP = r'''
# Text-only Image2 style filters. The external thumbnail URLs are UI previews only;
# only these stable IDs are passed to the worker. The filter modifies rendering
# treatment, never the requested subject, composition, background, or object count.
IMAGE2_STYLE_FILTER_PROMPTS: dict[str, str] = {
    "inkprint": "Apply a handcrafted linocut / relief-print treatment: carved confident contour lines, bold ink shapes, simplified value groups, purposeful crosshatching, limited spot colors, and subtle print texture. Keep the subject legible. Do not add text, symbols, or a new paper background.",
    "oilpainting": "Apply a convincing oil-on-canvas treatment with layered pigments, controlled visible brush strokes, subtle glazing, painterly edge transitions, rich midtones, and natural canvas tooth. Preserve geometry and key details; do not blur the subject, force swirling strokes, or add warm sunset lighting unless requested.",
    "traditional-japan": "Use a traditional Japanese woodblock-print language inspired by ukiyo-e: clear ink contours, flat layered color, deliberate negative space, elegant asymmetry, simplified atmospheric depth, and restrained indigo, mineral blue, vermilion and earth tones where suitable. Do not add Japanese motifs or replace the scene unless requested.",
    "fantasy": "Apply polished fantasy concept-art treatment through atmospheric depth, evocative value design, layered color, selective luminous accents, and painterly detail hierarchy. Preserve the actual subject and scene; do not invent dragons, castles, magical creatures, runes, portals, or props.",
    "cartoon": "Use a clean 2D cartoon style with confident outlines, simplified but accurate silhouettes, readable shape language, flat color blocks, restrained cel shading, and intentional highlights. Keep the subject recognizable and do not add speech bubbles, props, or childish exaggeration unless requested.",
    "3d": "Give the existing subject a designed 3D-rendered appearance: coherent volume, believable material response, physically plausible shading, controlled ambient occlusion, soft contact shadows, and readable geometry. Preserve all shapes, proportions, viewpoint, and composition. Do not assume bright white studio lighting, glossy plastic, or extra objects.",
    "cartoonfun": "Apply a playful, energetic cartoon-illustration finish with expressive rounded shapes, lively curves, rhythmic color blocking, coordinated cheerful colors, and a fun graphic finish. Keep the original subject and object count. Do not add confetti, stars, characters, toys, emojis, or decorative clutter.",
    "digital-art": "Apply refined digital-art treatment with controlled digital brushwork, nuanced shading, intentional edge control, layered color transitions, crisp focal details, and a cohesive art-directed palette. Do not impose neon, holograms, fantasy props, excess glow, or a new environment.",
    "comic": "Apply professional comic-book rendering: bold controlled inking, expressive contour weights, graphic shadow shapes, selective halftone texture, clear focal hierarchy, and purposeful highlights. Preserve the scene. Do not add panels, speech bubbles, captions, sound effects, or lettering unless requested.",
    "painting": "Translate the subject into a versatile fine-art painting treatment with intentional brushwork, layered pigment-like color, expressive but controlled edges, surface texture, and painterly light transitions. Do not force oil, watercolor, gouache, or acrylic unless specified, and do not add scenery.",
    "dark": "Apply a deliberate dark, low-key treatment with deeper shadow values, restrained highlights, controlled contrast, subdued color, and selective local illumination. Preserve the user's setting and time of day; do not brighten the image, add golden-hour light, neon, fog, or a new night background unless asked.",
    "sketch": "Render the subject as a refined hand-drawn sketch using graphite-like strokes, varied line weight, light construction marks, deliberate hatching, and restrained paper texture. Preserve perspective and geometry. Do not add labels, measurements, arrows, grids, annotations, or blueprint symbols.",
    "mock": "Treat #mock as an early-stage rough concept draft, not as a polished presentation mockup. Establish primary masses and silhouettes first; use loose exploratory strokes and light construction guides; simplify secondary details; keep materials partially resolved; and use rough shading or broad color blocking instead of final polish. Preserve the user's subject, object count, essential geometry, spatial relationships, camera, perspective, and composition. For architecture, retain existing building masses, levels, openings, and circulation cues; roughen the finish without redesigning the architecture. Do not create a product-on-background mockup, device frame, poster, presentation board, CAD wireframe, blueprint grid, notes, labels, dimensions, logos, watermarks, extra objects, or a new background. The result should read as a first-pass concept explored by a designer, less finished than a polished sketch or render.",
    "2000s-phone": "Apply an authentic early-2000s compact digital-camera / phone snapshot look: modest sensor detail, limited dynamic range, slightly imperfect white balance, subtle chroma noise, mild JPEG compression, gentle softness, and direct flash only where the scene supports it. Preserve the original subject and background. Do not add VHS lines, film scratches, date stamps, camera UI, frames, or a new party setting.",
    "cyberpunk": "Apply a restrained cyberpunk treatment through controlled cyan-and-magenta color, selective neon-like accents, cinematic contrast, cooler shadow colors, and edge reflections only where materials support them. Preserve the current scene, subject, architecture, object count, camera, and setting. Do not add neon signs, holograms, vehicles, rain, wet pavement, sci-fi buildings, or a new city background unless requested.",
}
'''


def patch_prompts(text: str) -> str:
    old_fn = 'def build_text_to_image_prompt(scene_details=None, has_style_reference=False) -> str:'
    if text.count(old_fn) != 1:
        raise ValueError(f"worker/prompts.py: function marker count is {text.count(old_fn)}")
    text = text.replace(old_fn, PROMPT_MAP + '\n\ndef build_text_to_image_prompt(scene_details=None, has_style_reference=False, style_filters=None) -> str:', 1)
    old_body_start = '''    """Text-to-image prompt with no baked-in bright/daylight aesthetic."""
    parts = [
        (
            "Create the subject and scene described by the user as a coherent, intentional image. Preserve explicit choices for "
            "subject, composition, camera, materials, palette, lighting, time of day, mood and visual medium. Do not assume an "
            "unrequested style or lighting setup."
        ),
        (
            "Maintain internal visual consistency: believable proportions where relevant, coherent perspective, consistent object "
            "identity, intentional detail hierarchy and clean rendering appropriate to the requested medium."
        ),
    ]
    if has_style_reference:
        parts.extend([
            (
                "A dedicated Style/Filter reference is attached. Its visual appearance takes priority over generic image-quality defaults. "
                "Reproduce its actual tonal range, brightness, contrast, shadow density, highlight behavior, saturation, palette, color cast, "
                "surface finish, texture, edge quality and art direction. The result may be dark, subdued, cool, low-key, matte, stylized or "
                "illustrative when that is what the reference shows."
            ),
            (
                "Do not automatically make the image bright, airy, warm, sunlit, glossy, clean-white, saturated or conventionally photorealistic. "
                "Do not add soft natural daylight, golden-hour light, ambient glow, glossy reflections or lifted shadows unless the Style image "
                "or user's written prompt calls for them."
            ),
        ])
    else:
        parts.append(
            "Let the user's prompt decide the lighting and mood. Do not add default daylight, high-key exposure, warm color grading, glossy materials or artificial glow when they were not requested."
        )
    parts.append(_sanitize_scene_details(scene_details))
    return _join(parts)'''
    new_body = '''    """Subject-first text-to-image prompt with optional text-only style filters."""
    parts = [
        (
            "Create the subject and scene described by the user as a coherent, intentional image. Preserve explicit choices for "
            "subject, composition, camera, materials, palette, lighting, time of day, mood and visual medium. Do not assume an "
            "unrequested style or lighting setup."
        ),
        (
            "Maintain internal visual consistency: believable proportions where relevant, coherent perspective, consistent object "
            "identity, intentional detail hierarchy and clean rendering appropriate to the requested medium."
        ),
    ]
    user_description = _sanitize_scene_details(scene_details)
    if user_description:
        parts.append(user_description)

    selected_filters: list[str] = []
    if isinstance(style_filters, (list, tuple)):
        for value in style_filters:
            if isinstance(value, str) and value in IMAGE2_STYLE_FILTER_PROMPTS and value not in selected_filters:
                selected_filters.append(value)

    if selected_filters:
        parts.append("Apply these text-only visual style filters after interpreting the user's subject: " + ", ".join(f"#{item}" for item in selected_filters) + ".")
        parts.extend(IMAGE2_STYLE_FILTER_PROMPTS[item] for item in selected_filters)
        parts.append(
            "Style filters modify rendering technique, linework, texture, color treatment, shading and finish only. They are not source images, "
            "subjects, objects, scene descriptions, backgrounds, overlays, or separate layers. Preserve the user's requested subject, composition, "
            "object count, architectural geometry and setting. If selected styles conflict, prioritize the first selected style and keep the image readable."
        )
    elif has_style_reference:
        # Backward compatibility for older clients that still submit a separate style image.
        parts.extend([
            (
                "A separate Style reference image is attached. Treat it only as an aesthetic guide and preserve its tonal range, contrast, palette, "
                "texture and rendering medium without copying its subject or composition unless requested."
            ),
            (
                "Do not automatically brighten, warm, whiten, add gloss or force a photorealistic architectural look when the reference does not show those traits."
            ),
        ])
    else:
        parts.append(
            "Let the user's prompt decide the lighting and mood. Do not add default daylight, high-key exposure, warm color grading, glossy materials or artificial glow when they were not requested."
        )
    return _join(parts)'''
    text = replace_once(text, old_body_start, new_body, 'replace text-to-image prompt body')
    text = replace_once(text,
        'build_text_to_image_prompt(scene_details=details, has_style_reference=bool(fields.get("styleReferenceUrl")))',
        'build_text_to_image_prompt(scene_details=details, has_style_reference=bool(fields.get("styleReferenceUrl")), style_filters=fields.get("styleFilters"))',
        'pass style filters into Text-to-Image prompt')
    return text


def patch_tests(text: str) -> str:
    text = replace_once(text,
        'from prompts import add_image_reference_map',
        'from prompts import add_image_reference_map, build_text_to_image_prompt',
        'test imports')
    if 'def test_image2_mock_filter_is_rough_concept_not_presentation_mockup' in text:
        raise ValueError('Image2 style filter tests already appear to be installed; refusing duplicate insertion.')
    tests = '''\n\ndef test_image2_style_filters_are_text_only_and_preserve_subject():
    prompt = build_text_to_image_prompt(
        scene_details="A compact two-storey house beside an olive grove.",
        style_filters=["inkprint", "dark"],
    )
    assert "#inkprint, #dark" in prompt
    assert "carved confident contour lines" in prompt
    assert "low-key treatment" in prompt
    assert "not source images" in prompt
    assert "backgrounds, overlays, or separate layers" in prompt


def test_image2_mock_filter_is_rough_concept_not_presentation_mockup():
    prompt = build_text_to_image_prompt(
        scene_details="A small courtyard house with a shaded loggia.",
        style_filters=["mock"],
    )
    assert "#mock" in prompt
    assert "early-stage rough concept draft" in prompt
    assert "not as a polished presentation mockup" in prompt
    assert "without redesigning the architecture" in prompt
    assert "device frame, poster, presentation board" in prompt


def test_unknown_image2_style_filter_ids_are_ignored():
    prompt = build_text_to_image_prompt(
        scene_details="A simple white massing model.",
        style_filters=["mockup", "not-a-real-filter"],
    )
    assert "#mockup" not in prompt
    assert "not-a-real-filter" not in prompt
    assert "Apply these text-only visual style filters" not in prompt
'''
    return text.rstrip() + tests + '\n'


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--repo', default='.', help='Path to the local repository root (default: current directory)')
    args = parser.parse_args()
    root = Path(args.repo).expanduser().resolve()
    targets = {
        'workspace': root / 'web/components/studio/image2-workspace.tsx',
        'api': root / 'web/app/api/generate/route.ts',
        'prompts': root / 'worker/prompts.py',
        'tests': root / 'worker/tests/test_reference_mapping.py',
    }
    missing = [str(path) for path in targets.values() if not path.is_file()]
    if missing:
        print('ERROR: These expected project files were not found:', file=sys.stderr)
        print('\n'.join(f'  - {item}' for item in missing), file=sys.stderr)
        print('Run this script from the repository root or pass --repo "<root>".', file=sys.stderr)
        return 2

    original = {key: path.read_text(encoding='utf-8') for key, path in targets.items()}
    try:
        patched = {
            'workspace': patch_workspace(original['workspace']),
            'api': patch_api(original['api']),
            'prompts': patch_prompts(original['prompts']),
            'tests': patch_tests(original['tests']),
        }
    except Exception as exc:
        print(f'ERROR: Patch validation failed; no project files were written.\n{exc}', file=sys.stderr)
        return 3

    # All transformations validated before touching disk. Back up every target, then write.
    backup_paths: list[Path] = []
    for key, path in targets.items():
        backup = path.with_name(path.name + '.before-image2-style-filters.bak')
        if backup.exists():
            print(f'ERROR: Backup already exists; refusing to overwrite it: {backup}', file=sys.stderr)
            print('No project files were written. Rename/remove that backup explicitly and rerun.', file=sys.stderr)
            return 4
        backup_paths.append(backup)

    written: list[Path] = []
    try:
        for key, path in targets.items():
            backup = path.with_name(path.name + '.before-image2-style-filters.bak')
            shutil.copy2(path, backup)
            path.write_text(patched[key], encoding='utf-8', newline='\n')
            written.append(path)
    except Exception as exc:
        for key, path in targets.items():
            if path in written:
                path.write_text(original[key], encoding='utf-8', newline='\n')
        print(f'ERROR: Write failed; attempted to restore originals. {exc}', file=sys.stderr)
        return 5

    print('Image2 text-only Style Filters patch applied locally.')
    print('Changed production files:')
    for key in ('workspace', 'api', 'prompts'):
        print(f'  - {targets[key]}')
    print('Updated tests:')
    print(f'  - {targets["tests"]}')
    print('Backups:')
    for path in backup_paths:
        print(f'  - {path}')
    print('\nNext verify:')
    print('  cd web && npm run build')
    print('  cd ../worker && python -m pytest tests/test_reference_mapping.py')
    print('\nNo GitHub write operations were performed by this script.')
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
