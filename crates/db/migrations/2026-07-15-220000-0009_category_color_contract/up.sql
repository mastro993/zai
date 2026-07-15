UPDATE transaction_categories
SET color = upper(color)
WHERE color IS NOT NULL
  AND length(color) = 7
  AND color GLOB '#[0-9A-Fa-f][0-9A-Fa-f][0-9A-Fa-f][0-9A-Fa-f][0-9A-Fa-f][0-9A-Fa-f]';

UPDATE transaction_categories
SET color = NULL
WHERE color IS NOT NULL
  AND (
    length(color) != 7
    OR color NOT GLOB '#[0-9A-Fa-f][0-9A-Fa-f][0-9A-Fa-f][0-9A-Fa-f][0-9A-Fa-f][0-9A-Fa-f]'
  );
