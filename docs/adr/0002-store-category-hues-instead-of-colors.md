# Store category hue angles instead of concrete colors

Zai stores a numeric hue angle for each root category instead of a concrete
color. Badge foreground and background colors are derived from that hue for the
active theme, preserving user intent while allowing contrast and theme behavior
to evolve. This replaces the simpler alternative of persisting the currently
rendered color. Chromatic values use the half-open range from zero to 360;
`null` represents neutral because an achromatic color has no hue. APIs accept
any valid hue angle rather than restricting values to the curated form palette;
360 degrees is normalized to zero. Stored hues use integer degrees because
sub-degree precision adds serialization complexity without visible category
picker value. Schema migration replaces the legacy concrete-color field without
converting its data, so existing categories become neutral. This deliberately
trades preservation of presentation preferences for a small, deterministic
migration with no legacy color compatibility path. Hue angles use OKLCH because
Zai's theme tokens already use that color space and its perceptual axes let
lightness and chroma change for contrast without changing hue identity. The
database, backend models, and API rename `color` to `hue` atomically; no legacy
field alias is retained. User-facing category forms and CSV import/export
continue to call the value `color`; the frontend maps that value to the backend
`hue` field at the transport boundary.
