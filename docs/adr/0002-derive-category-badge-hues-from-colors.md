# Derive category badge hues from stored colors

Zai persists and transports each root category's validated `#RRGGBB` color.
There is no category-hue database column, API field, or schema migration.

The frontend extracts the hue from the stored HEX color and uses that angle to
derive OKLCH badge backgrounds and foregrounds for the active theme. This keeps
the durable contract stable while allowing badge contrast, chroma, and opacity
to evolve independently. Achromatic HEX colors have no hue and use the neutral
badge treatment.

The category form offers eight chromatic HEX choices spaced 45 degrees apart,
starting with red: `#C32828`, `#C39B28`, `#75C328`, `#28C34E`, `#28C3C3`,
`#284EC3`, `#7528C3`, and `#C3289B`. An achromatic neutral is the ninth choice.
A tenth custom color control opens a color picker. After selection, that
control previews the chosen custom color, remains selected, and can reopen the
picker. Stored colors outside the curated choices remain unchanged and appear
as custom; no palette migration recolors existing categories. Child categories
do not choose a separate color in the frontend and display their root
category's effective color.
