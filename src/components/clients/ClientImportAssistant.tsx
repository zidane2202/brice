"use client";

import { ImportAssistant } from "@/components/ImportAssistant";
import { ClientCsvImportModal } from "@/components/clients/ClientCsvImport";
import { toImportCsv, type ImportRow, type ImportSlot } from "@/lib/client-import";

const WELCOME =
  "Envoyez-moi votre liste de clients, sous n'importe quelle forme : texte collé, capture d'écran, photo, PDF, Excel, Word ou contacts. Je la convertis en fichier CSV prêt à importer. Les champs manquants restent vides.";

export function ClientImportAssistant({ freeSlots }: { freeSlots: ImportSlot[] }) {
  return (
    <ImportAssistant<ImportRow>
      endpoint="/api/clients/import-assistant"
      dialogLabel="Assistant d'import de clients"
      welcome={WELCOME}
      filenamePrefix="clients-import"
      toCsv={toImportCsv}
      foundLabel={(count) => `${count} client(s) trouvé(s)`}
      renderImport={(rows, close) => (
        <ClientCsvImportModal open={rows !== null} onClose={close} initialRows={rows ?? undefined} freeSlots={freeSlots} />
      )}
    />
  );
}
