import { JsonDisplay } from "@/components/JsonDisplay";
import { Stronghold } from "@/lib/stronghold";
import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";

export const Route = createFileRoute("/settings/playgrounds/")({
  component: RouteComponent,
});

function RouteComponent() {
  const [stronghold, setStronghold] = useState<Stronghold | null>(null);
  const [key, setKey] = useState<string>("");
  const [value, setValue] = useState<string>("");
  const [retrievedValue, setRetrievedValue] = useState<unknown>(undefined);
  const [isLoading, setIsLoading] = useState(false);

  console.log("key", key);

  useEffect(() => {
    Stronghold.init().then((stronghold) => {
      setStronghold(stronghold);
    });
  }, []);

  const handleSetValue = async () => {
    if (!stronghold || !key || !value) {
      toast.error("Please fill in all fields");
      return;
    }

    setIsLoading(true);
    try {
      await stronghold.insert(key, value);
      await stronghold.save();
      toast.success("Value saved successfully");
      setValue("");
    } catch (error) {
      toast.error("Failed to save value");
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleGetValue = async () => {
    if (!stronghold || !key) {
      toast.error("Please enter a key");
      return;
    }

    setIsLoading(true);
    try {
      const result = await stronghold.get(key);
      setRetrievedValue(result);
      if (result === undefined) {
        toast.info("No value found for this key");
      } else {
        toast.success("Value retrieved successfully");
      }
    } catch (error) {
      toast.error("Failed to retrieve value");
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteValue = async () => {
    if (!stronghold || !key) {
      toast.error("Please enter a key");
      return;
    }

    setIsLoading(true);
    try {
      await stronghold.remove(key);
      await stronghold.save();
      setRetrievedValue(undefined);
      toast.success("Value deleted successfully");
    } catch (error) {
      toast.error("Failed to delete value");
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="p-8  mx-auto">
      <h1 className="text-2xl font-bold mb-6">Stronghold Playground</h1>

      <div className="space-y-6">
        <div className="card bg-base-200 p-6">
          <h2 className="text-xl font-semibold mb-4">Store Operations</h2>

          <div className="space-y-4">
            <div className="form-control">
              <label className="label">
                <span className="label-text">Key</span>
              </label>
              <input
                type="text"
                className="input input-bordered"
                value={key}
                onChange={(e) => setKey(e.target.value)}
                placeholder="Enter key"
              />
            </div>

            <div className="form-control">
              <label className="label">
                <span className="label-text">Value</span>
              </label>
              <input
                type="text"
                className="input input-bordered"
                value={value}
                onChange={(e) => setValue(e.target.value)}
                placeholder="Enter value"
              />
            </div>

            <div className="flex gap-2">
              <button
                className="btn btn-primary"
                onClick={handleSetValue}
                disabled={isLoading}
              >
                Set Value
              </button>
              <button
                className="btn btn-secondary"
                onClick={handleGetValue}
                disabled={isLoading}
              >
                Get Value
              </button>
              <button
                className="btn btn-error"
                onClick={handleDeleteValue}
                disabled={isLoading}
              >
                Delete Value
              </button>
            </div>
          </div>
        </div>

        <div className="card bg-base-200 p-6">
          <h2 className="text-xl font-semibold mb-4">Retrieved Value</h2>
          <div className="p-4 bg-base-300 rounded-lg">
            {retrievedValue ? (
              <pre className="whitespace-pre-wrap">
                {typeof retrievedValue === "string"
                  ? retrievedValue
                  : JSON.stringify(retrievedValue)}
              </pre>
            ) : (
              <span className="text-base-content/60">
                No value retrieved yet
              </span>
            )}
          </div>
        </div>

        <div className="card bg-base-200 p-6">
          <h2 className="text-xl font-semibold mb-4">Debug Information</h2>
          <div className="space-y-4">
            <div>
              <h3 className="font-medium mb-2">Stronghold</h3>
              <JsonDisplay data={stronghold} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
