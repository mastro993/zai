import type { ReactElement, ReactNode } from "react";
import { toast as sonnerToast, type ExternalToast, type ToastT, type ToastToDismiss } from "sonner";

import { ToastItem, type ToastVariant } from "./toast-item";

type ToastMessage = (() => ReactNode) | ReactNode;

type PromiseInput<ToastData> = Promise<ToastData> | (() => Promise<ToastData>);

interface ToastPromiseOptions<ToastData> extends Omit<ExternalToast, "description"> {
  loading?: ReactNode;
  success?: ReactNode | ((data: ToastData) => ReactNode | Promise<ReactNode>);
  error?: ReactNode | ((error: unknown) => ReactNode | Promise<ReactNode>);
  description?: ReactNode | ((data: ToastData) => ReactNode | Promise<ReactNode>);
  finally?: () => void | Promise<void>;
}

const SUCCESS_DURATION_MS = 4000;
const INFO_DURATION_MS = 4000;
const WARNING_DURATION_MS = 6000;
const ERROR_DURATION_MS = 6000;

function defaultDuration(variant: ToastVariant, data?: ExternalToast): number | undefined {
  if (data?.duration !== undefined) {
    return data.duration;
  }

  if (variant === "loading") {
    return Number.POSITIVE_INFINITY;
  }

  if ((variant === "error" || variant === "warning") && data?.action) {
    return Number.POSITIVE_INFINITY;
  }

  switch (variant) {
    case "success":
      return SUCCESS_DURATION_MS;
    case "warning":
      return WARNING_DURATION_MS;
    case "error":
      return ERROR_DURATION_MS;
    default:
      return INFO_DURATION_MS;
  }
}

function renderToast(
  variant: ToastVariant,
  message: ToastMessage,
  data?: ExternalToast,
): string | number {
  const {
    description,
    action,
    cancel,
    icon,
    closeButton,
    className: _className,
    classNames: _classNames,
    unstyled: _unstyled,
    style: _style,
    ...sonnerData
  } = data ?? {};

  return sonnerToast.custom(
    (id) => (
      <ToastItem
        id={id}
        variant={variant}
        title={message}
        description={description}
        action={action}
        cancel={cancel}
        icon={icon}
        closeButton={closeButton}
      />
    ),
    {
      ...sonnerData,
      duration: defaultDuration(variant, data),
    },
  );
}

async function resolveMessage<Arg>(
  value: ReactNode | ((arg: Arg) => ReactNode | Promise<ReactNode>) | undefined,
  arg: Arg,
  fallback: ReactNode,
): Promise<ReactNode> {
  if (value === undefined) {
    return fallback;
  }
  if (typeof value === "function") {
    return value(arg);
  }
  return value;
}

function toast(message: ToastMessage, data?: ExternalToast): string | number {
  return renderToast("default", message, data);
}

toast.success = (message: ToastMessage, data?: ExternalToast) =>
  renderToast("success", message, data);
toast.info = (message: ToastMessage, data?: ExternalToast) => renderToast("info", message, data);
toast.warning = (message: ToastMessage, data?: ExternalToast) =>
  renderToast("warning", message, data);
toast.error = (message: ToastMessage, data?: ExternalToast) => renderToast("error", message, data);
toast.loading = (message: ToastMessage, data?: ExternalToast) =>
  renderToast("loading", message, data);
toast.message = (message: ToastMessage, data?: ExternalToast) =>
  renderToast("default", message, data);

toast.custom = (
  jsx: (id: number | string) => ReactElement,
  data?: ExternalToast,
): string | number => sonnerToast.custom(jsx, data);

toast.dismiss = (id?: number | string) => sonnerToast.dismiss(id);

function promiseToast<ToastData>(
  promise: PromiseInput<ToastData>,
  options: ToastPromiseOptions<ToastData> = {},
) {
  const { loading, success, error, description, finally: onFinally, ...rest } = options;
  const id = renderToast("loading", loading ?? "Loading…", {
    ...rest,
    description: typeof description === "function" ? undefined : description,
  });

  const pending = (typeof promise === "function" ? promise() : promise)
    .then(async (result) => {
      const message = await resolveMessage(success, result, "Done");
      const resolvedDescription =
        typeof description === "function" ? await description(result) : description;

      renderToast("success", message, {
        ...rest,
        id,
        description: resolvedDescription,
      });
      await onFinally?.();
      return result;
    })
    .catch(async (cause: unknown) => {
      const message = await resolveMessage(error, cause, "Something went wrong");
      renderToast("error", message, { ...rest, id });
      await onFinally?.();
      throw cause;
    });

  return Object.assign(id, { unwrap: () => pending }) as typeof id & {
    unwrap: () => Promise<ToastData>;
  };
}

toast.promise = promiseToast;

toast.getHistory = (): (ToastT | ToastToDismiss)[] => sonnerToast.getHistory();
toast.getToasts = (): (ToastT | ToastToDismiss)[] => sonnerToast.getToasts();

export { toast };
export type { ExternalToast, ToastMessage, ToastPromiseOptions, ToastVariant };
