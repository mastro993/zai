import { Navbar } from "@/components/Navbar";
import { Button, useDisclosure } from "@heroui/react";
import { Download, Plus, Upload } from "lucide-react";
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
            <Download className="w-4 h-4" /> Import
          </Button>
          <Button onPress={exportModal.onOpen}>
            <Upload className="w-4 h-4" /> Export
          </Button>
          <Button onPress={addModal.onOpen}>
            <Plus /> Add category
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
