import { Navbar } from "@/components/Navbar";
import { Button, useDisclosure } from "@heroui/react";
import { Download01Icon, PlusSignIcon, Upload01Icon } from "@hugeicons/core-free-icons";
import { Icon } from "@/components/ui/icon";
import { useHotkeys } from "react-hotkeys-hook";
import { TransactionCategoryExportDialog } from "../components/TransactionCategoryExportDialog";
import { TransactionCategoryFormDialog } from "../components/TransactionCategoryFormDialog";
import { TransactionCategoryImportModal } from "../components/TransactionCategoryImportModal";
import { TransactionCategoryList } from "../components/TransactionCategoryList";
import { TransactionCategorySelection } from "../components/TransactionCategorySelection";

export const TransactionCategoriesScreen = () => {
  const importModal = useDisclosure();
  const exportModal = useDisclosure();
  const addModal = useDisclosure();

  useHotkeys("mod+n", () => addModal.onOpen());

  return (
    <div className="flex flex-col">
      <Navbar title="Categories">
        <div className="flex gap-2">
          <TransactionCategorySelection />
          <Button variant="solid" onPress={importModal.onOpen}>
            <Icon icon={Download01Icon} className="w-4 h-4" /> Import
          </Button>
          <Button onPress={exportModal.onOpen}>
            <Icon icon={Upload01Icon} className="w-4 h-4" /> Export
          </Button>
          <Button onPress={addModal.onOpen}>
            <Icon icon={PlusSignIcon} /> Add category
          </Button>
        </div>
      </Navbar>

      <TransactionCategoryList />

      {/** Modals */}
      <TransactionCategoryImportModal {...importModal} />
      <TransactionCategoryExportDialog {...exportModal} />
      <TransactionCategoryFormDialog {...addModal} />
    </div>
  );
};
