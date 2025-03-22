export const withMetaKey =
  (handler: (event: React.MouseEvent<HTMLLIElement>) => void) =>
  (event: React.MouseEvent<HTMLLIElement>) => {
    if (event.metaKey) {
      handler(event);
    }
  };
