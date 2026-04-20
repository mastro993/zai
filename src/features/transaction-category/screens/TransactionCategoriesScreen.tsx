import { Navbar } from "@/components/Navbar";
import { Button, useOverlayState } from "@heroui/react";
import { Download01Icon, PlusSignIcon, Upload01Icon } from "@hugeicons/core-free-icons";
import { Icon } from "@/components/ui/icon";
import { useHotkeys } from "react-hotkeys-hook";
import { TransactionCategoryExportDialog } from "../components/TransactionCategoryExportDialog";
import { TransactionCategoryFormDialog } from "../components/TransactionCategoryFormDialog";
import { TransactionCategoryImportModal } from "../components/TransactionCategoryImportModal";
import { TransactionCategoryList } from "../components/TransactionCategoryList";
import { TransactionCategorySelection } from "../components/TransactionCategorySelection";

export const TransactionCategoriesScreen = () => {
  const importModal = useOverlayState();
  const exportModal = useOverlayState();
  const addModal = useOverlayState();

  useHotkeys("mod+n", () => addModal.open());

  return (
    <div className="flex flex-col">
      <Navbar title="Categories">
        <div className="flex gap-2">
          <TransactionCategorySelection />
          <Button variant="solid" onPress={importModal.open}>
            <Icon icon={Download01Icon} className="w-4 h-4" /> Import
          </Button>
          <Button onPress={exportModal.open}>
            <Icon icon={Upload01Icon} className="w-4 h-4" /> Export
          </Button>
          <Button onPress={addModal.open}>
            <Icon icon={PlusSignIcon} /> Add category
          </Button>
        </div>
      </Navbar>

      <TransactionCategoryList />

      {/** Modals */}
      <TransactionCategoryImportModal
        isOpen={importModal.isOpen}
        onOpenChange={importModal.setOpen}
      />
      <TransactionCategoryExportDialog
        isOpen={exportModal.isOpen}
        onOpenChange={exportModal.setOpen}
      />
      <TransactionCategoryFormDialog isOpen={addModal.isOpen} onOpenChange={addModal.setOpen} />
    </div>
  );
};
