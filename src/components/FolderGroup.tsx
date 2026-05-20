import { Folder, Trash2 } from "lucide-react";
import type { Service, ServiceState } from "../lib/types";
import { ServiceRow } from "./ServiceRow";

interface Props {
  folderLabel: string;
  services: Service[];
  states: Record<string, ServiceState>;
  onToggleService: (service: Service, running: boolean) => void;
  onViewLogs: (service: Service) => void;
  onDeleteService: (service: Service) => void;
  onDeleteFolder: (folderLabel: string) => void;
  onEditService: (service: Service) => void;
}

export function FolderGroup({
  folderLabel,
  services,
  states,
  onToggleService,
  onViewLogs,
  onDeleteService,
  onDeleteFolder,
  onEditService,
}: Props) {
  return (
    <div className="space-y-1">
      <div className="flex items-center gap-2 px-1 text-xs font-medium text-zinc-400">
        <Folder className="h-3.5 w-3.5" />
        <span>{folderLabel}</span>
        <button
          type="button"
          onClick={() => onDeleteFolder(folderLabel)}
          className="ml-1 rounded p-0.5 text-zinc-600 hover:bg-rose-500/10 hover:text-rose-400"
          aria-label={`Delete folder ${folderLabel}`}
          title="Delete folder"
        >
          <Trash2 className="h-3 w-3" />
        </button>
      </div>
      <div className="space-y-0.5">
        {services.map((service) => (
          <ServiceRow
            key={service.id}
            service={service}
            state={states[service.id]}
            onToggle={onToggleService}
            onViewLogs={onViewLogs}
            onDelete={onDeleteService}
            onEdit={onEditService}
          />
        ))}
      </div>
    </div>
  );
}
