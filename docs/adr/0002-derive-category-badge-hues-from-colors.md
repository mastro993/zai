# Derive category badge hues from stored colors

Zai persists and transports each root category's validated `#RRGGBB` color.
There is no category-hue database column, API field, or schema migration.

The frontend extracts the hue from the stored HEX color and uses that angle to
derive OKLCH badge backgrounds and foregrounds for the active theme. This keeps
the durable contract stable while allowing badge contrast, chroma, and opacity
to evolve independently. Achromatic HEX colors have no hue and use the neutral
badge treatment.

The category form offers ten distinct HEX choices, including an achromatic
neutral choice. A stored custom HEX color remains valid even when it is not one
of those choices; the picker simply leaves every curated swatch unselected.
Child categories do not choose a separate color in the frontend and display
their root category's effective color.
