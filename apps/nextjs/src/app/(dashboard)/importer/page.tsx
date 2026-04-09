"use client";

import { useState, useCallback } from "react";
import * as XLSX from "xlsx";
import { useTRPC } from "~/trpc/react";
import { useMutation } from "@tanstack/react-query";
import { Button } from "@acme/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@acme/ui/table";
import {
  UploadCloud,
  CheckCircle2,
  AlertCircle,
  FileSpreadsheet,
  ChevronRight,
  Users,
  Building2,
  RefreshCw,
  X,
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────
interface ParsedRow {
  nombre_comunidad?: string;
  direccion?: string;
  nombre_vecino?: string;
  email_vecino?: string;
  telefono?: string;
  piso_puerta?: string;
  [key: string]: unknown;
}

interface CommunityGroup {
  name: string;
  address?: string;
  neighbors: {
    name: string;
    email: string;
    phone?: string;
    unit?: string;
  }[];
}

// ─── Excel parser ─────────────────────────────────────────────────────────────
function groupByCommunity(rows: ParsedRow[]): CommunityGroup[] {
  const map = new Map<string, CommunityGroup>();

  for (const row of rows) {
    const name = String(
      row.nombre_comunidad ?? row["Nombre Comunidad"] ?? row["nombre"] ?? "",
    ).trim();
    if (!name) continue;

    if (!map.has(name)) {
      map.set(name, {
        name,
        address: String(
          row.direccion ?? row["Dirección"] ?? row["direccion"] ?? "",
        ).trim() || undefined,
        neighbors: [],
      });
    }

    const email = String(
      row.email_vecino ?? row["Email"] ?? row["email"] ?? "",
    ).trim();
    const neighborName = String(
      row.nombre_vecino ?? row["Nombre Vecino"] ?? row["vecino"] ?? "",
    ).trim();

    const group = map.get(name)!;

    if (email && neighborName) {
      // Validate email format
      if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        group.neighbors.push({
          name: neighborName,
          email,
          phone:
            String(row.telefono ?? row["Teléfono"] ?? row["telefono"] ?? "").trim() ||
            undefined,
          unit:
            String(row.piso_puerta ?? row["Piso/Puerta"] ?? row["piso"] ?? "").trim() ||
            undefined,
        });
      }
    }
  }

  return Array.from(map.values());
}

// ─── Drop zone ────────────────────────────────────────────────────────────────
function DropZone({
  onFile,
  isDragging,
  setIsDragging,
}: {
  onFile: (f: File) => void;
  isDragging: boolean;
  setIsDragging: (v: boolean) => void;
}) {
  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      const f = e.dataTransfer.files[0];
      if (f && (f.name.endsWith(".xlsx") || f.name.endsWith(".xls"))) onFile(f);
    },
    [onFile, setIsDragging],
  );

  return (
    <div
      onDrop={handleDrop}
      onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
      onDragLeave={() => setIsDragging(false)}
      className={`rounded-xl border-2 border-dashed p-16 flex flex-col items-center justify-center text-center transition-all cursor-pointer ${
        isDragging
          ? "border-primary bg-primary/5 scale-[1.01]"
          : "border-border bg-card hover:border-primary/50 hover:bg-muted/30"
      }`}
      onClick={() => document.getElementById("file-upload")?.click()}
    >
      <div className="rounded-full bg-primary/10 p-4 mb-4">
        <UploadCloud className={`h-8 w-8 ${isDragging ? "text-primary" : "text-muted-foreground"}`} />
      </div>
      <h3 className="font-semibold text-lg mb-1">Arrastra tu Excel aquí</h3>
      <p className="text-sm text-muted-foreground mb-4 max-w-sm">
        O haz clic para explorar. Acepta <strong>.xlsx</strong> y <strong>.xls</strong>
      </p>
      <Button variant="outline" size="sm" asChild>
        <span>
          <FileSpreadsheet className="mr-2 h-4 w-4" />
          Seleccionar archivo
        </span>
      </Button>
      <input
        id="file-upload"
        type="file"
        accept=".xlsx,.xls"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) onFile(f);
        }}
      />
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────
export default function ExcelImporterPage() {
  const trpc = useTRPC();
  const [file, setFile] = useState<File | null>(null);
  const [rawRows, setRawRows] = useState<ParsedRow[]>([]);
  const [headers, setHeaders] = useState<string[]>([]);
  const [communities, setCommunities] = useState<CommunityGroup[]>([]);
  const [activeSheet, setActiveSheet] = useState(0);
  const [sheetNames, setSheetNames] = useState<string[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [result, setResult] = useState<{
    communities: number;
    neighbors: number;
    errors: string[];
  } | null>(null);

  const importMutation = useMutation(
    trpc.community.import.mutationOptions({
      onSuccess: (data: any) => {
        setResult(data);
        setFile(null);

        setRawRows([]);
        setCommunities([]);
      },
    }),
  );

  const parseFile = (selectedFile: File, sheetIndex = 0) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const data = e.target?.result as string;

      const workbook = XLSX.read(data, { type: "binary" });
      setSheetNames(workbook.SheetNames);

      const sheetName = workbook.SheetNames[sheetIndex];
      if (!sheetName) return;
      const worksheet = workbook.Sheets[sheetName];
      if (!worksheet) return;

      const json = XLSX.utils.sheet_to_json<ParsedRow>(worksheet);
      const hdrs = json.length > 0 ? Object.keys(json[0]!) : [];

      setRawRows(json);
      setHeaders(hdrs);
      setCommunities(groupByCommunity(json));
    };
    reader.readAsBinaryString(selectedFile);
  };

  const handleFile = (f: File) => {
    setFile(f);
    setResult(null);
    parseFile(f, 0);
    setActiveSheet(0);
  };

  const handleSheetChange = (idx: number) => {
    setActiveSheet(idx);
    if (file) parseFile(file, idx);
  };

  const handleImport = () => {
    if (!communities.length) return;
    // @ts-ignore - TS types are lagging behind router definition
    importMutation.mutate({ communities });
  };


  const reset = () => {
    setFile(null);
    setRawRows([]);
    setCommunities([]);
    setResult(null);
    setSheetNames([]);
  };

  const totalNeighbors = communities.reduce((acc, c) => acc + c.neighbors.length, 0);

  return (
    <div className="flex flex-col gap-8 max-w-5xl">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight mb-2">Importador Masivo</h1>
        <p className="text-muted-foreground text-sm max-w-xl">
          Carga un Excel con los datos de comunidades y vecinos. Las columnas reconocidas son:{" "}
          <code className="bg-muted px-1 rounded text-xs">nombre_comunidad</code>,{" "}
          <code className="bg-muted px-1 rounded text-xs">direccion</code>,{" "}
          <code className="bg-muted px-1 rounded text-xs">nombre_vecino</code>,{" "}
          <code className="bg-muted px-1 rounded text-xs">email_vecino</code>,{" "}
          <code className="bg-muted px-1 rounded text-xs">telefono</code>,{" "}
          <code className="bg-muted px-1 rounded text-xs">piso_puerta</code>.
        </p>
      </div>

      {/* Success result */}
      {result && (
        <div className="rounded-xl border-2 border-green-200 bg-green-50 p-6">
          <div className="flex items-start gap-4">
            <CheckCircle2 className="h-8 w-8 text-green-600 shrink-0 mt-0.5" />
            <div className="flex-1">
              <h3 className="font-semibold text-green-900 text-lg mb-2">
                ¡Importación completada!
              </h3>
              <div className="grid grid-cols-2 gap-3 mb-3">
                <div className="flex items-center gap-2 text-sm text-green-800">
                  <Building2 className="h-4 w-4" />
                  <strong>{result.communities}</strong> comunidades creadas
                </div>
                <div className="flex items-center gap-2 text-sm text-green-800">
                  <Users className="h-4 w-4" />
                  <strong>{result.neighbors}</strong> vecinos registrados
                </div>
              </div>
              {result.errors.length > 0 && (
                <div className="mt-3 rounded-lg bg-amber-50 border border-amber-200 p-3">
                  <p className="text-xs font-semibold text-amber-800 mb-1">
                    Advertencias ({result.errors.length}):
                  </p>
                  {result.errors.slice(0, 5).map((e, i) => (
                    <p key={i} className="text-xs text-amber-700">• {e}</p>
                  ))}
                </div>
              )}
              <Button size="sm" variant="outline" onClick={reset} className="mt-4">
                <RefreshCw className="mr-2 h-3.5 w-3.5" />
                Nueva importación
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Drop zone or file info */}
      {!file ? (
        <DropZone
          onFile={handleFile}
          isDragging={isDragging}
          setIsDragging={setIsDragging}
        />
      ) : (
        <>
          {/* File indicator */}
          <div className="flex items-center gap-3 rounded-xl border bg-primary/5 px-5 py-3">
            <FileSpreadsheet className="h-5 w-5 text-primary" />
            <span className="font-medium text-sm text-primary flex-1">{file.name}</span>
            <span className="text-xs text-muted-foreground">
              {(file.size / 1024).toFixed(0)} KB
            </span>
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={reset}>
              <X className="h-4 w-4" />
            </Button>
          </div>

          {/* Sheet selector */}
          {sheetNames.length > 1 && (
            <div className="flex gap-2">
              {sheetNames.map((name, i) => (
                <button
                  key={name}
                  onClick={() => handleSheetChange(i)}
                  className={`rounded-full border px-4 py-1.5 text-sm font-medium transition-all ${
                    activeSheet === i
                      ? "bg-primary text-white border-primary"
                      : "border-border text-muted-foreground hover:border-primary/40"
                  }`}
                >
                  {name}
                </button>
              ))}
            </div>
          )}

          {/* Summary cards */}
          <div className="grid gap-4 sm:grid-cols-3">
            {[
              { icon: FileSpreadsheet, label: "Filas en Excel", value: rawRows.length },
              { icon: Building2, label: "Comunidades detectadas", value: communities.length },
              { icon: Users, label: "Vecinos con email válido", value: totalNeighbors },
            ].map(({ icon: Icon, label, value }) => (
              <div key={label} className="flex items-center gap-3 rounded-xl border bg-card p-4">
                <div className="rounded-lg bg-primary/10 p-2">
                  <Icon className="h-4 w-4 text-primary" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">{label}</p>
                  <p className="text-2xl font-bold">{value}</p>
                </div>
              </div>
            ))}
          </div>

          {/* Communities preview */}
          {communities.length > 0 && (
            <div className="flex flex-col gap-3">
              <h2 className="font-semibold text-base">
                Vista previa de datos ({Math.min(communities.length, 5)} de {communities.length} comunidades)
              </h2>
              <div className="rounded-xl border overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/30">
                      <TableHead>Comunidad</TableHead>
                      <TableHead>Dirección</TableHead>
                      <TableHead className="text-right">Vecinos</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {communities.slice(0, 10).map((c, i) => (
                      <TableRow key={i}>
                        <TableCell className="font-medium">
                          <div className="flex items-center gap-2">
                            <Building2 className="h-4 w-4 text-muted-foreground" />
                            {c.name}
                          </div>
                        </TableCell>
                        <TableCell className="text-muted-foreground text-sm">
                          {c.address ?? "—"}
                        </TableCell>
                        <TableCell className="text-right">
                          <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 text-primary px-2.5 py-0.5 text-xs font-semibold">
                            <Users className="h-3 w-3" />
                            {c.neighbors.length}
                          </span>
                        </TableCell>
                      </TableRow>
                    ))}
                    {communities.length > 10 && (
                      <TableRow>
                        <TableCell colSpan={3} className="text-center text-xs text-muted-foreground py-2">
                          + {communities.length - 10} comunidades más
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </div>
          )}

          {/* Warnings */}
          {rawRows.length > 0 && communities.length === 0 && (
            <div className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4">
              <AlertCircle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
              <div>
                <p className="font-medium text-amber-800 text-sm">
                  No se detectaron comunidades válidas
                </p>
                <p className="text-xs text-amber-700 mt-1">
                  Asegúrate de que el Excel tenga una columna llamada{" "}
                  <code className="bg-amber-100 px-1 rounded">nombre_comunidad</code>.
                  Columnas encontradas: {headers.join(", ")}
                </p>
              </div>
            </div>
          )}

          {/* Import button */}
          {communities.length > 0 && (
            <div className="flex items-center justify-between rounded-xl border bg-card p-5">
              <div>
                <p className="font-semibold">¿Todo listo para importar?</p>
                <p className="text-sm text-muted-foreground">
                  Se crearán{" "}
                  <strong className="text-foreground">{communities.length}</strong>{" "}
                  comunidades con{" "}
                  <strong className="text-foreground">{totalNeighbors}</strong> vecinos.
                </p>
              </div>
              <Button
                size="lg"
                onClick={handleImport}
                disabled={importMutation.isPending}
                className="gap-2"
              >
                {importMutation.isPending ? (
                  <>
                    <RefreshCw className="h-4 w-4 animate-spin" />
                    Importando...
                  </>
                ) : (
                  <>
                    Importar ahora
                    <ChevronRight className="h-4 w-4" />
                  </>
                )}
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
