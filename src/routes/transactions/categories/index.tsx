import { Navbar } from "@/components/layout/Navbar";
import { useModal } from "@/hooks/useModal";
import { createFileRoute } from "@tanstack/react-router";
import { Plus } from "lucide-react";

export const Route = createFileRoute("/transactions/categories/")({
  component: RouteComponent,
});

function RouteComponent() {
  const handleAddCategory = () => {};

  const { openModal, Modal } = useModal({
    title: "Add new category",
    content: (
      <div className="space-y-4">
        <input
          type="text"
          placeholder="Icon"
          className="input input-neutral w-full"
        />
        <input
          type="text"
          placeholder="Name"
          className="input input-neutral w-full"
        />
        <input
          type="text"
          placeholder="Description"
          className="input input-neutral w-full"
        />
        <input
          type="text"
          placeholder="Color"
          className="input input-neutral w-full"
          pattern="#[0-9a-fA-F]{6}"
        />
      </div>
    ),
    buttons: [
      {
        label: "Save",
        onClick: handleAddCategory,
        variant: "primary",
      },
      {
        label: "Close",
        onClick: () => {},
        variant: "ghost",
      },
    ],
    showCloseButton: true,
    closeOnBackdropClick: true,
  });

  return (
    <>
      <div>
        <Navbar>
          <h1 className="text-lg text-content">Categories</h1>
          <div className="flex gap-2">
            <button className="btn" onClick={openModal}>
              <Plus className="w-4 h-4" />
              Add category
            </button>
          </div>
        </Navbar>
      </div>
      <Modal />
    </>
  );
}
