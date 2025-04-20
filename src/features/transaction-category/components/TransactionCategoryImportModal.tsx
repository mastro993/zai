import { Button } from "@/components/ui/button";
import { InjectedModalProps, Modal } from "@/components/widgets/Modal";
import { FileUp, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useImportCategories } from "../hooks/useImportCategories";
type TransactionCategoryImportModalProps = InjectedModalProps;

export const TransactionCategoryImportModal = (
  props: TransactionCategoryImportModalProps
) => {
  const { selectFile, rawCategories, importCategories, isImporting } =
    useImportCategories(() => {
      toast.success("Categories imported");
      props.onDismiss?.();
    });

  return (
    <Modal title="Import categories" fullScreen {...props}>
      {!rawCategories && (
        <div
          className="flex-1 bg-base-200 rounded-md flex flex-col items-center justify-center gap-4 cursor-pointer border-dashed border-2 border-base-300"
          onClick={selectFile}
        >
          <FileUp className="w-16 h-16 text-primary" />
          <p>Drop a file here or click to upload</p>
        </div>
      )}
      {rawCategories && (
        <div className="flex-1 overflow-auto border border-base-300 rounded-md">
          <table className="table table-zebra table-xs table-pin-rows w-full">
            {/* head */}
            <thead>
              <tr>
                <th className="w-10">Id</th>
                <th className="w-60">Name</th>
                <th className="w-60">Parent</th>
                <th className="w-20">Color</th>
                <th>Description</th>
              </tr>
            </thead>
            <tbody>
              {rawCategories.map((category) => (
                <tr key={category.id}>
                  <td className="font-mono">{category.id}</td>
                  <td>{category.name}</td>
                  <td>{category.parent?.name ?? "-"}</td>
                  <td className="font-mono">{category.color}</td>
                  <td>{category.description}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <div className="flex-0 flex gap-2 justify-end">
        <Button
          variant="outline"
          onClick={props.onDismiss}
          disabled={isImporting}
        >
          Cancel
        </Button>
        <Button onClick={() => importCategories()} disabled={isImporting}>
          {isImporting && <Loader2 className="animate-spin" />}
          Import {rawCategories?.length ?? ""} categories
        </Button>
      </div>
    </Modal>
  );
};
