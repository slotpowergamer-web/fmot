import React, { useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  ArrowRightLeft,
  CheckCircle2,
  Database,
  ExternalLink,
  Loader2,
  Lock,
  LogOut,
  PauseCircle,
  RefreshCw,
  Search,
  ShieldAlert,
} from 'lucide-react';
import { usePortal } from '../../context/PortalContext';
import {
  clearMigrationCheckpoint,
  readMigrationCheckpoint,
  type MigrationInventory,
  type MigrationProgress,
  type MigrationReport,
} from '../../lib/supabase';

const PAGE_NAMES: Record<string, string> = {
  identidade: 'Identidade / Logo',
  inicio: 'Início',
  quem_somos: 'Quem Somos',
  hierarquia: 'Hierarquia',
  funcoes: 'Funções',
  operacoes: 'Operações',
  galeria: 'Galeria',
};

export const AdminSupabaseMigrationPanel: React.FC = () => {
  const {
    supabaseHealth,
    supabaseAdminEmail,
    supabaseReadyForWrites,
    supabasePrimaryActive,
    quotaUpgradeUrl,
    refreshSupabaseHealth,
    signInSupabaseAdmin,
    signOutSupabaseAdmin,
    inspectFirebaseMigration,
    runFirebaseToSupabaseMigration,
    showToast,
  } = usePortal();

  const [email, setEmail] = useState('slotpowergamer@gmail.com');
  const [password, setPassword] = useState('');
  const [signingIn, setSigningIn] = useState(false);
  const [checking, setChecking] = useState(false);

  const [inspecting, setInspecting] = useState(false);
  const [inventory, setInventory] = useState<MigrationInventory | null>(null);

  const [batchSize, setBatchSize] = useState<number>(4);
  const [migrating, setMigrating] = useState(false);
  const [progress, setProgress] = useState<MigrationProgress | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [report, setReport] = useState<MigrationReport | null>(null);
  const [checkpoint, setCheckpoint] = useState(() => readMigrationCheckpoint());

  const abortControllerRef = useRef<AbortController | null>(null);

  const progressPercent = useMemo(() => {
    if (!progress || progress.totalPendingImages <= 0) return 0;
    return Math.min(100, Math.round((progress.processedImages / progress.totalPendingImages) * 100));
  }, [progress]);

  const handleRefresh = async () => {
    setChecking(true);
    setErrorMsg(null);
    try {
      await refreshSupabaseHealth();
    } finally {
      setChecking(false);
    }
  };

  const handleSupabaseLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setSigningIn(true);
    setErrorMsg(null);
    try {
      await signInSupabaseAdmin(email, password);
      setPassword('');
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Falha na autenticação do Supabase.');
    } finally {
      setSigningIn(false);
    }
  };

  const handleInspect = async () => {
    setInspecting(true);
    setErrorMsg(null);
    try {
      const result = await inspectFirebaseMigration();
      setInventory(result);
      setCheckpoint(readMigrationCheckpoint());
      if (result.totalDiscoveredImages > 0) {
        showToast(
          `Verificação concluída: ${result.totalDiscoveredImages} imagem(ns) acessível(is) (${result.pendingImagesCount} pendente(s)).`,
          'success'
        );
      } else if (result.firestoreServerStatus === 'quota_exceeded') {
        showToast(
          'Firestore com limite diário atingido e nenhuma imagem encontrada no cache local deste navegador.',
          'error'
        );
      } else {
        showToast('Verificação concluída. Nenhuma imagem pendente encontrada.', 'success');
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Falha ao inspecionar origens no Firebase.';
      setErrorMsg(msg);
      showToast(msg, 'error');
    } finally {
      setInspecting(false);
    }
  };

  const handleStartMigration = async () => {
    setMigrating(true);
    setErrorMsg(null);
    setReport(null);
    const controller = new AbortController();
    abortControllerRef.current = controller;

    try {
      const result = await runFirebaseToSupabaseMigration({
        batchSize,
        signal: controller.signal,
        inventory: inventory ?? undefined,
        onProgress: (nextProgress) => setProgress(nextProgress),
      });
      setReport(result);
      setCheckpoint(readMigrationCheckpoint());

      // Refresh read-only inventory so remaining counts stay 100% real
      try {
        const updatedInventory = await inspectFirebaseMigration();
        setInventory(updatedInventory);
      } catch {
        // Ignore secondary refresh error
      }

      if (result.pausedByUser) {
        showToast(
          `Transferência pausada. ${result.migratedImages} imagem(ns) confirmada(s) no Supabase; você pode retomar depois.`,
          'success'
        );
      } else if (result.failedImages === 0 && result.migratedImages > 0) {
        showToast(
          `${result.migratedImages} fotografia(s) transferida(s) e verificada(s) no bucket fmot-media.`,
          'success'
        );
      } else if (result.failedImages > 0) {
        showToast(
          `Transferência encerrada com ${result.failedImages} falha(s). Você pode retomar apenas os itens pendentes.`,
          'error'
        );
      } else {
        showToast('Nenhum arquivo novo pendente. Registros sincronizados.', 'success');
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Falha durante a migração para o Supabase.';
      setErrorMsg(msg);
      showToast(msg, 'error');
    } finally {
      abortControllerRef.current = null;
      setMigrating(false);
    }
  };

  const handlePauseMigration = () => {
    abortControllerRef.current?.abort();
  };

  const handleClearCheckpoint = () => {
    clearMigrationCheckpoint();
    setCheckpoint(null);
  };

  const hasResumableWork = Boolean(
    checkpoint || (inventory && inventory.pendingImagesCount > 0 && inventory.alreadyMigratedCount > 0)
  );

  const canStartTransfer = Boolean(
    supabaseReadyForWrites &&
      !migrating &&
      !inspecting &&
      (!inventory || inventory.canTransferNow)
  );

  return (
    <section className="space-y-5 border border-[#263F24]/70 bg-[#0B100C]/90 p-6">
      <div className="flex flex-wrap items-start justify-between gap-4 border-b border-[#263F24]/45 pb-4">
        <div>
          <div className="flex items-center gap-2 text-[#8BAA43]">
            <Database className="h-4 w-4" />
            <p className="font-mono text-[11px] tracking-[0.2em]">
              ARMAZENAMENTO SUPABASE · MIGRAÇÃO CONTROLADA EM LOTES
            </p>
          </div>
          <h3 className="mt-1 font-display text-2xl font-bold text-[#F1F3EC]">
            Supabase Storage & Banco de Dados
          </h3>
          <p className="mt-1 text-xs text-[#A5AAA2]">
            Bucket ativo <span className="font-mono text-[#F1F3EC]">fmot-media</span> e tabela{' '}
            <span className="font-mono text-[#F1F3EC]">media_assets</span>.{' '}
            {supabasePrimaryActive
              ? 'O site já está carregando dados e fotografias prioritariamente pelo Supabase (Firebase preservado apenas como backup).'
              : 'O Firebase permanece intacto como backup e a transferência só ocorre sob comando explícito do administrador.'}
          </p>
        </div>

        <button
          type="button"
          disabled={checking}
          onClick={() => void handleRefresh()}
          className="inline-flex items-center gap-2 border border-[#263F24] px-3.5 py-2 text-xs font-semibold text-[#A5AAA2] transition-colors hover:border-[#8BAA43] hover:text-[#F1F3EC] disabled:opacity-50"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${checking ? 'animate-spin' : ''}`} />
          Reverificar Conexão
        </button>
      </div>

      {/* Checklist of real verified readiness */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="border border-[#263F24]/50 bg-[#050705] p-3.5 text-xs">
          <p className="font-mono text-[10px] text-[#A5AAA2]">CONEXÃO SUPABASE</p>
          <p className="mt-1 font-semibold text-[#F1F3EC]">
            {supabaseHealth?.connected ? 'Conectado' : 'Aguardando conexão'}
          </p>
        </div>
        <div className="border border-[#263F24]/50 bg-[#050705] p-3.5 text-xs">
          <p className="font-mono text-[10px] text-[#A5AAA2]">TABELAS SQL</p>
          <p className="mt-1 font-semibold text-[#F1F3EC]">
            {supabaseHealth?.schemaReady
              ? 'Prontas'
              : supabaseHealth?.permissionDeniedTables?.length
                ? 'Permissões SQL pendentes'
                : 'Pendente (schema.sql)'}
          </p>
        </div>
        <div className="border border-[#263F24]/50 bg-[#050705] p-3.5 text-xs">
          <p className="font-mono text-[10px] text-[#A5AAA2]">BUCKET fmot-media</p>
          <p className="mt-1 font-semibold text-[#F1F3EC]">
            {supabaseHealth?.storageBucketReady ? 'Ativo (leitura pública direta)' : 'Pendente'}
          </p>
        </div>
        <div className="border border-[#263F24]/50 bg-[#050705] p-3.5 text-xs">
          <p className="font-mono text-[10px] text-[#A5AAA2]">ESCRITA ADMIN (RLS)</p>
          <p className="mt-1 font-semibold text-[#F1F3EC]">
            {supabaseAdminEmail ? `Autenticado (${supabaseAdminEmail})` : 'Login Supabase pendente'}
          </p>
        </div>
      </div>

      {/* Action required if schema/bucket or SQL GRANT permissions are pending */}
      {supabaseHealth && (!supabaseHealth.schemaReady || !supabaseHealth.storageBucketReady) && (
        <div className="flex items-start gap-3 border border-[#8BAA43]/50 bg-[#050705] p-4 text-xs text-[#A5AAA2]">
          <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-[#8BAA43]" />
          <div className="space-y-1">
            <p className="font-semibold text-[#F1F3EC]">
              {supabaseHealth.permissionDeniedTables?.length && !supabaseHealth.missingTables?.length
                ? 'Ajuste de permissões SQL (GRANT/RLS) pendente no Supabase'
                : 'Execute o script SQL no painel do Supabase para criar as tabelas e o bucket'}
            </p>
            <p className="leading-relaxed">
              {supabaseHealth.permissionDeniedTables?.length && !supabaseHealth.missingTables?.length ? (
                <>
                  As tabelas já existem no Supabase, porém faltam privilégios SQL de leitura pública e
                  endurecimento de RLS. Execute o script complementar{' '}
                  <span className="font-mono text-[#F1F3EC]">supabase/fix_rls_and_security.sql</span> no{' '}
                  <strong className="text-[#F1F3EC]">SQL Editor</strong> do Supabase (sem apagar dados) e
                  clique em <strong className="text-[#F1F3EC]">Reverificar Conexão</strong>.
                </>
              ) : (
                <>
                  Abra o <strong className="text-[#F1F3EC]">SQL Editor</strong> do seu projeto Supabase,
                  cole e execute o arquivo{' '}
                  <span className="font-mono text-[#F1F3EC]">supabase/schema.sql</span> deste projeto, e
                  clique em <strong className="text-[#F1F3EC]">Reverificar Conexão</strong>.
                </>
              )}
            </p>
          </div>
        </div>
      )}

      {/* Supabase Admin Auth form to satisfy RLS policies */}
      {!supabaseAdminEmail ? (
        <form
          onSubmit={(e) => void handleSupabaseLogin(e)}
          className="space-y-3 border border-[#263F24]/50 bg-[#050705] p-4"
        >
          <div className="flex items-center gap-2 text-xs font-semibold text-[#F1F3EC]">
            <Lock className="h-3.5 w-3.5 text-[#8BAA43]" />
            Etapa 1 — Autenticar Administrador no Supabase (para uploads e gravação protegidos por RLS)
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="E-mail admin no Supabase"
              className="border border-[#263F24] bg-[#0B100C] px-3 py-2 text-xs text-[#F1F3EC]"
            />
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Senha da conta no Supabase Auth"
              className="border border-[#263F24] bg-[#0B100C] px-3 py-2 text-xs text-[#F1F3EC]"
            />
            <button
              type="submit"
              disabled={signingIn}
              className="inline-flex items-center justify-center gap-2 bg-[#526B32] px-4 py-2 text-xs font-semibold text-[#F1F3EC] transition-colors hover:bg-[#8BAA43] hover:text-[#050705] disabled:opacity-50"
            >
              {signingIn ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Lock className="h-3.5 w-3.5" />}
              Conectar Sessão Supabase
            </button>
          </div>
        </form>
      ) : (
        <div className="flex flex-wrap items-center justify-between gap-3 border border-[#263F24]/50 bg-[#050705] p-4">
          <div className="flex items-center gap-2.5 text-xs text-[#F1F3EC]">
            <CheckCircle2 className="h-4 w-4 text-[#8BAA43]" />
            <span>
              Sessão Supabase ativa como <strong>{supabaseAdminEmail}</strong>
              {supabaseReadyForWrites
                ? ' — pronto para inspeção e transferência controlada.'
                : ' — verifique as permissões das tabelas antes de iniciar.'}
            </span>
          </div>
          <button
            type="button"
            onClick={() => void signOutSupabaseAdmin()}
            className="inline-flex items-center gap-1.5 border border-[#263F24] px-3 py-1.5 text-xs text-[#A5AAA2] hover:border-[#D62828] hover:text-[#F1F3EC]"
          >
            <LogOut className="h-3.5 w-3.5" />
            Desconectar Supabase
          </button>
        </div>
      )}

      {/* Step 2 & 3 Controls: Pre-flight Read-Only Inspection + Controlled Batched Transfer */}
      <div className="space-y-4 border border-[#263F24]/50 bg-[#050705] p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs font-semibold text-[#F1F3EC]">
              Etapa 2 — Verificação Técnica e Transferência em Lotes
            </p>
            <p className="mt-0.5 text-[11px] text-[#A5AAA2]">
              Inspecione primeiro as origens (Firestore + cache local do navegador) sem modificar dados.
              Cada arquivo só é marcado como migrado após confirmação real no bucket{' '}
              <span className="font-mono text-[#F1F3EC]">fmot-media</span>.
            </p>
          </div>

          <label className="flex items-center gap-2 text-xs text-[#A5AAA2]">
            <span>Tamanho do lote:</span>
            <select
              value={batchSize}
              disabled={migrating}
              onChange={(e) => setBatchSize(Number(e.target.value) || 4)}
              className="border border-[#263F24] bg-[#0B100C] px-2.5 py-1.5 text-xs text-[#F1F3EC]"
            >
              <option value={2}>2 imagens / lote</option>
              <option value={4}>4 imagens / lote (recomendado)</option>
              <option value={8}>8 imagens / lote</option>
            </select>
          </label>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            disabled={inspecting || migrating}
            onClick={() => void handleInspect()}
            className="inline-flex items-center gap-2 border border-[#8BAA43]/70 bg-[#0B100C] px-4 py-2.5 text-xs font-semibold tracking-wider text-[#F1F3EC] transition-colors hover:bg-[#263F24] disabled:cursor-not-allowed disabled:opacity-45"
          >
            {inspecting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4 text-[#8BAA43]" />}
            {inspecting ? 'VERIFICANDO ORIGENS...' : 'VERIFICAR IMAGENS DISPONÍVEIS'}
          </button>

          {!migrating ? (
            <button
              type="button"
              disabled={!canStartTransfer}
              onClick={() => void handleStartMigration()}
              className="inline-flex items-center gap-2 bg-[#526B32] px-5 py-2.5 text-xs font-semibold tracking-wider text-[#F1F3EC] transition-colors hover:bg-[#8BAA43] hover:text-[#050705] disabled:cursor-not-allowed disabled:opacity-45"
            >
              <ArrowRightLeft className="h-4 w-4" />
              {hasResumableWork
                ? 'RETOMAR TRANSFERÊNCIA PARA O SUPABASE'
                : 'INICIAR TRANSFERÊNCIA PARA O SUPABASE'}
            </button>
          ) : (
            <button
              type="button"
              onClick={handlePauseMigration}
              className="inline-flex items-center gap-2 border border-[#D62828] bg-[#D62828]/15 px-5 py-2.5 text-xs font-semibold tracking-wider text-[#F1F3EC] transition-colors hover:bg-[#D62828]/30"
            >
              <PauseCircle className="h-4 w-4 text-[#D62828]" />
              PAUSAR TRANSFERÊNCIA
            </button>
          )}

          {checkpoint && !migrating && (
            <button
              type="button"
              onClick={handleClearCheckpoint}
              className="text-[11px] text-[#A5AAA2] underline underline-offset-2 hover:text-[#F1F3EC]"
            >
              Limpar ponto de retomada local
            </button>
          )}
        </div>

        {/* Live Pre-flight Inventory Result */}
        {inventory && (
          <div className="space-y-3 border-t border-[#263F24]/45 pt-4 text-xs">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="font-semibold text-[#8BAA43]">
                Diagnóstico Técnico das Origens (somente leitura)
              </p>
              <span className="font-mono text-[10px] text-[#A5AAA2]">
                Firestore Servidor:{' '}
                <strong
                  className={
                    inventory.firestoreServerStatus === 'online'
                      ? 'text-[#8BAA43]'
                      : 'text-[#D62828]'
                  }
                >
                  {inventory.firestoreServerStatus === 'online'
                    ? 'ONLINE'
                    : inventory.firestoreServerStatus === 'quota_exceeded'
                      ? 'COTA DIÁRIA EXCEDIDA (HTTP 429)'
                      : 'ERRO DE LEITURA'}
                </strong>
              </span>
            </div>

            {inventory.firestoreErrorMessage && (
              <div className="flex flex-col justify-between gap-3 border border-[#D62828]/60 bg-[#D62828]/10 p-3 text-[11px] text-[#F1F3EC] sm:flex-row sm:items-center">
                <div className="flex items-start gap-2">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-[#D62828]" />
                  <div>
                    <p className="font-semibold">Erro real retornado pelo Firestore:</p>
                    <p className="mt-0.5 text-[#A5AAA2]">{inventory.firestoreErrorMessage}</p>
                  </div>
                </div>
                <a
                  href={quotaUpgradeUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex shrink-0 items-center gap-1.5 border border-[#8BAA43] px-3 py-1.5 text-[11px] font-semibold text-[#F1F3EC] hover:bg-[#8BAA43] hover:text-[#050705]"
                >
                  <ExternalLink className="h-3.5 w-3.5" />
                  Abrir Firebase Console
                </a>
              </div>
            )}

            <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-4">
              <div className="border border-[#263F24]/40 bg-[#0B100C] p-3">
                <p className="font-mono text-[10px] text-[#A5AAA2]">IMAGENS ACESSÍVEIS AGORA</p>
                <p className="mt-1 text-lg font-bold text-[#F1F3EC]">
                  {inventory.totalDiscoveredImages}
                </p>
                <p className="mt-0.5 text-[10px] text-[#A5AAA2]">
                  Servidor: {inventory.bySource.firestore_server} · Cache Firestore:{' '}
                  {inventory.bySource.firestore_cache} · Cache Local: {inventory.bySource.local_cache}
                </p>
              </div>
              <div className="border border-[#263F24]/40 bg-[#0B100C] p-3">
                <p className="font-mono text-[10px] text-[#A5AAA2]">JÁ NO SUPABASE</p>
                <p className="mt-1 text-lg font-bold text-[#8BAA43]">
                  {inventory.alreadyMigratedCount}
                </p>
                <p className="mt-0.5 text-[10px] text-[#A5AAA2]">
                  Total em media_assets: {inventory.supabaseExistingMediaCount}
                </p>
              </div>
              <div className="border border-[#263F24]/40 bg-[#0B100C] p-3">
                <p className="font-mono text-[10px] text-[#A5AAA2]">PENDENTES DE TRANSFERÊNCIA</p>
                <p className="mt-1 text-lg font-bold text-[#F1F3EC]">
                  {inventory.pendingImagesCount}
                </p>
                <p className="mt-0.5 text-[10px] text-[#A5AAA2]">Sem duplicação garantida por ID</p>
              </div>
              <div className="border border-[#263F24]/40 bg-[#0B100C] p-3">
                <p className="font-mono text-[10px] text-[#A5AAA2]">REGISTROS DE SEÇÕES</p>
                <p className="mt-1 text-lg font-bold text-[#F1F3EC]">
                  {inventory.metadataCounts.totalRecords}
                </p>
                <p className="mt-0.5 text-[10px] text-[#A5AAA2]">
                  Slots: {inventory.metadataCounts.slots} · Integrantes:{' '}
                  {inventory.metadataCounts.hierarchyMembers} · Galeria:{' '}
                  {inventory.metadataCounts.gallery}
                </p>
              </div>
            </div>

            {Object.keys(inventory.byPage).length > 0 && (
              <div className="flex flex-wrap gap-2 text-[11px] text-[#A5AAA2]">
                {Object.entries(inventory.byPage).map(([page, count]) => (
                  <span
                    key={page}
                    className="border border-[#263F24]/50 bg-[#0B100C] px-2.5 py-1 font-mono"
                  >
                    {PAGE_NAMES[page] || page}: <strong className="text-[#F1F3EC]">{count}</strong>
                  </span>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Real-time Progress Bar during Batched Transfer */}
        {progress && (migrating || progress.phase === 'paused') && (
          <div className="space-y-2 border-t border-[#263F24]/45 pt-4 text-xs">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="font-semibold text-[#8BAA43]">{progress.statusText}</span>
              <span className="font-mono text-[11px] text-[#F1F3EC]">
                {progress.totalPendingImages > 0
                  ? `${progress.processedImages}/${progress.totalPendingImages} (${progressPercent}%)`
                  : 'Sincronizando...'}
              </span>
            </div>
            <div className="h-2 w-full overflow-hidden bg-[#141D15]">
              <div
                className="h-full bg-[#8BAA43] transition-all duration-300"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
            <div className="flex flex-wrap gap-4 font-mono text-[10px] text-[#A5AAA2]">
              <span>
                Lote: {progress.currentBatch}/{progress.totalBatches || 1}
              </span>
              <span>Confirmadas: {progress.migratedImages}</span>
              <span>Já existentes: {progress.alreadyMigratedImages}</span>
              <span>Falhas: {progress.failedImages}</span>
              <span>Registros de página: {progress.syncedMetadataRecords}</span>
            </div>
          </div>
        )}
      </div>

      {errorMsg && (
        <div className="border border-[#D62828]/60 bg-[#D62828]/10 p-3.5 text-xs text-[#F1F3EC]">
          {errorMsg}
        </div>
      )}

      {report && (
        <div className="space-y-2 border border-[#526B32]/60 bg-[#050705] p-4 text-xs text-[#F1F3EC]">
          <p className="font-semibold text-[#8BAA43]">
            Relatório da Transferência{' '}
            {report.pausedByUser ? '(Pausada — retomável sem duplicações)' : '(Firebase preservado intacto como backup)'}
          </p>
          <ul className="space-y-1 text-[#A5AAA2]">
            <li>
              Imagens acessíveis na origem: <strong className="text-[#F1F3EC]">{report.totalSourceImages}</strong>
            </li>
            <li>
              Transferidas e verificadas no bucket <span className="font-mono">fmot-media</span>:{' '}
              <strong className="text-[#8BAA43]">{report.migratedImages}</strong> (uploads confirmados:{' '}
              {report.verifiedUploads})
            </li>
            <li>
              Já existentes no Supabase (não duplicadas):{' '}
              <strong className="text-[#F1F3EC]">{report.alreadyMigratedImages}</strong>
            </li>
            <li>
              Pendentes restantes: <strong className="text-[#F1F3EC]">{report.remainingPendingImages}</strong>
            </li>
            <li>
              Registros de seções sincronizados:{' '}
              <strong className="text-[#F1F3EC]">{report.syncedMetadataRecords}</strong>
            </li>
            <li>
              Falhas: <strong className={report.failedImages > 0 ? 'text-[#D62828]' : 'text-[#F1F3EC]'}>{report.failedImages}</strong>
            </li>
          </ul>
          {report.errors.length > 0 && (
            <div className="mt-2 border-t border-[#263F24]/50 pt-2 text-[11px] text-[#D62828]">
              {report.errors.map((err, i) => (
                <p key={i}>• {err}</p>
              ))}
            </div>
          )}
        </div>
      )}
    </section>
  );
};
