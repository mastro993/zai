# Use native macOS overlay chrome with shared web title bar

Zai will keep native macOS window decorations with an overlay title bar, hide the native title text, retain the native traffic lights, and use manual drag regions. This preserves native window behavior while integrating window chrome into the existing 48px application header.

Shell layout: full-height sidebar on the left; the 48px application header lives only in the content column (starts where the sidebar ends). On macOS Tauri, traffic lights sit over the top of the expanded sidebar (with a 48px spacer so nav is clear); when the sidebar is collapsed or mobile, the title bar reserves leading inset for the traffic lights. Web and desktop share the header structure, but desktop hides the brand and fully hides a collapsed sidebar, while web retains its brand and 48px collapsed icon rail. Sidebar state is a local UI preference with no database storage, and narrow layouts retain the existing non-persistent sidebar sheet.
