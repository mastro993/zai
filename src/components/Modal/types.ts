export type Handler = () => void;

export type InjectedProps = {
  onDismiss?: Handler;
  mode?: string;
};
