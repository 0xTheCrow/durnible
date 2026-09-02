# Android launcher icons

Read this before changing the app icon. The rasters in
`android/app/src/main/res/mipmap-*/` are maintained by hand from
`public/res/svg/durnible.svg`; there is no generation script.

## Geometry

An adaptive-icon layer is 108dp and the launcher masks it to a 72dp circle, so the mask
radius is `layerSize / 3`. The 66dp in Google's docs is the safe zone, not the mask.

The mark's outer ring is not a true circle: over a 1728px render its radius runs
861.0–864.75. Sizing the mark from its bounding box leaves a subpixel white gap at every
angle except the widest — 63 of 360 on a 159px icon, visible against a dark wallpaper.
Size from the ring's minimum radius, bled 1% past the mask so it is clipped rather than
gapped:

```
markRenderBox = (layerSize / 3) * 1.01 / (861.0 / 1728)
```

`861.0 / 1728` belongs to this ring. Re-measure it if the artwork is redrawn.

| density | layer | mark |
| ------- | ----- | ---- |
| mdpi    | 108   | 73   |
| hdpi    | 162   | 109  |
| xhdpi   | 216   | 146  |
| xxhdpi  | 324   | 219  |
| xxxhdpi | 432   | 292  |

## Files, per density

- `ic_launcher_background.png` (layer) — opaque white, mark composited at the render box
  above, centred. The art belongs in the background layer so it fills the mask edge to
  edge.
- `ic_launcher_monochrome.png` (layer) — mark composited on white, then
  `alpha = 255 - luminance` with RGB forced black. Same render box as the background.

`mipmap-anydpi-v26/ic_launcher.xml` is the only definition of `@mipmap/ic_launcher`. It
points `<background>` at `@mipmap/ic_launcher_background` and `<foreground>` at
`@android:color/transparent` — the element is required, the layer is unused — and carries
a `<monochrome>` line.

`minSdkVersion` is 26, so adaptive icons are always available. There are no legacy
`ic_launcher.png` rasters and no `android:roundIcon`; adding either back means every
density gains a file that only pre-Oreo launchers read.

## Regenerating

Rasterizing requires something that reads SVG; Pillow does not. `sharp`
(`npm i --no-save sharp`) covers rasterize, resize and composite in one package, and the
repo's Playwright Chromium also works. Rasterize at ~4× and reduce — the line work thins
out when rasterized directly at 73px.

## Verifying

Screencap a pinned icon, not the dock's prediction slot, which draws its own tinted ring.
Find the centre and ring radius, then walk outward at 360 angles and flag any
near-neutral pixel brighter than the local wallpaper. Correct output is 0 of 360.

A scan through the centre row alone passes while the diagonals still gap.
