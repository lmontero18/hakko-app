import { FolderPlus, Upload } from "lucide-react";

interface Props {
  onPickFolder: () => void;
  isOver?: boolean;
  compact?: boolean;
}

export function DropZone({ onPickFolder, isOver, compact }: Props) {
  if (compact) {
    return (
      <button
        type="button"
        onClick={onPickFolder}
        className="flex items-center gap-2 rounded-md border border-zinc-800 bg-zinc-900/60 px-3 py-2 text-sm text-zinc-300 hover:border-zinc-700 hover:bg-zinc-800"
      >
        <FolderPlus className="h-4 w-4" />
        Add folder
      </button>
    );
  }

  return (
    <div
      className={`flex flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed py-12 text-center transition-colors ${
        isOver
          ? "border-zinc-100 bg-white/5"
          : "border-zinc-800 bg-zinc-900/30"
      }`}
    >
      <Upload
        className={`h-8 w-8 transition-colors ${
          isOver ? "text-zinc-100" : "text-zinc-500"
        }`}
      />
      <div>
        <p className="font-medium text-zinc-200">Drop a folder here</p>
        <p className="mt-1 text-sm text-zinc-500">
          or{" "}
          <button
            type="button"
            onClick={onPickFolder}
            className="text-zinc-100 underline-offset-2 hover:underline"
          >
            browse for one
          </button>{" "}
          — we'll auto-detect the services inside.
        </p>
      </div>
    </div>
  );
}
