import { Toaster } from "react-hot-toast";

export const ToastContainer = () => {
  return (
    <Toaster
      position="bottom-right"
      toastOptions={{
        style: {
          border: "1px solid var(--color-accent)",
          borderRadius: "var(--radius-box)",
          padding: "16px",
          backgroundColor: "var(--color-base-content)",
          color: "var(--color-base-100)",
        },
      }}
    />
  );
};
