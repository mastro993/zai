export const toBackendDateTime = (value: string) => {
  return value.length === 16 ? `${value}:00` : value;
};

export const toDateTimeInputValue = (value: string) => {
  return value.slice(0, 16);
};
