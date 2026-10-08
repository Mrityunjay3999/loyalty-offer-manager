import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import {
  Copy,
  History as HistoryIcon,
  Download,
  XCircle,
  MoreVertical,
  Trash2,
  ChevronLeft,
  ChevronRight,
  Save,
  Send,
  Check,
  AlertTriangle,
  Clock,
  Lock,
} from 'lucide-react';
import { useAppStore } from '@/store/useAppStore';
import { useToasts } from '@/store/useToasts';
import { StatusPill } from '@/components/StatusPill';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { HistoryDrawer } from '@/components/HistoryDrawer';
import { EmptyState } from '@/components/EmptyState';
import { FieldRenderer } from '@/components/fields/FieldRenderer';
import { ValidationSummary } from '@/components/ValidationSummary';
import { StepNav, type StepInfo, type StepStatus } from '@/components/workspace/StepNav';
import { RightPanel } from '@/components/workspace/RightPanel';
import { LifecycleBar, type ApplyArgs } from '@/components/workspace/LifecycleBar';
import { GroupedOfferTab } from '@/components/workspace/GroupedOfferTab';
import { SubmissionFormDialog } from '@/components/SubmissionFormDialog';
import { PhaseBadge } from '@/components/PhaseBadge';
import { TagPill } from '@/components/TagPill';
import { isGroupedTabVisible } from '@/lib/visibility';
import { fields, fieldsByStep, fieldsById, STEP_ORDER } from '@/lib/dataLoaders';
import { statusOf, isLocked } from '@/lib/lifecycle';
import { optionsForField } from '@/lib/options';
import { isFieldVisible, visibilityReason, CONDITIONAL_FIELD_IDS } from '@/lib/visibility';
import { computedFieldValue, softLockDate } from '@/lib/calculations';
import { validateOffer, softLockWarning } from '@/lib/validation';
import { can } from '@/lib/permissions';
import { isNoValue, formatDate, todayISO, parseISO } from '@/lib/format';
import { feedChip } from '@/lib/feed';
import { toCsv, downloadCsv } from '@/lib/csv';
import type { OfferRecord, OfferValue, OfferSetupCombo, FieldDef } from '@/lib/types';

const REVIEW = 'Review';
const GROUPED_TAB = 'Child promotions';

type SaveState = 'saved' | 'saving' | 'unsaved';

export function OfferWorkspace() {
  const { offerId } = useParams();
  const navigate = useNavigate();
  const offers = useAppStore((s) => s.offers);
  const auditLog = useAppStore((s) => s.auditLog);
  const role = useAppStore((s) => s.role);
  const dropdowns = useAppStore((s) => s.dropdowns);
  const categorySubCategory = useAppStore((s) => s.categorySubCategory);
  const createDraft = useAppStore((s) => s.createDraft);
  const updateOffer = useAppStore((s) => s.updateOffer);
  const deleteOffer = useAppStore((s) => s.deleteOffer);
  const copyOffer = useAppStore((s) => s.copyOffer);
  const cancelOffer = useAppStore((s) => s.cancelOffer);
  const addAudit = useAppStore((s) => s.addAudit);
  const changeStatus = useAppStore((s) => s.changeStatus);
  const nextOfferId = useAppStore((s) => s.nextOfferId);
  const feedState = useAppStore((s) => s.feedState);
  const push = useToasts((s) => s.push);

  // Create a draft for /offers/new, then redirect to its uid.
  const creatingRef = useRef(false);
  useEffect(() => {
    if (!offerId && !creatingRef.current) {
      creatingRef.current = true;
      const uid = createDraft();
      navigate(`/offers/${uid}`, { replace: true });
    }
  }, [offerId, createDraft, navigate]);

  const stored = offers.find((o) => o._uid === offerId);
  const [working, setWorking] = useState<OfferRecord>(stored ?? {});
  const [step, setStep] = useState<string>(STEP_ORDER[0]);
  const [saveState, setSaveState] = useState<SaveState>('saved');
  const [lastSavedAt, setLastSavedAt] = useState<string>('');
  const [historyOpen, setHistoryOpen] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [submissionOpen, setSubmissionOpen] = useState(false);

  // Re-init working when the offer id changes.
  const loadedUid = useRef<string | undefined>(undefined);
  useEffect(() => {
    if (stored && stored._uid !== loadedUid.current) {
      setWorking(stored);
      loadedUid.current = stored._uid;
    }
  }, [stored]);

  const status = statusOf(working);
  const isDraft = status === 'Draft';
  const locked = isLocked(status); // A4: Completed - Data Final or Cancelled
  const canEdit = can(role, 'editOffer') && !locked;
  const readOnly = !canEdit;

  // --- validation ---
  const validation = useMemo(
    () => validateOffer(working, { allOffers: offers, categorySubCategory }),
    [working, offers, categorySubCategory],
  );
  const errorByField = useMemo(() => {
    const m: Record<string, string> = {};
    for (const e of validation.errors) if (!m[e.fieldId]) m[e.fieldId] = e.message;
    return m;
  }, [validation]);
  const warningByField = useMemo(() => {
    const m: Record<string, string> = {};
    for (const w of validation.warnings) if (!m[w.fieldId]) m[w.fieldId] = w.message;
    return m;
  }, [validation]);

  // --- change handling with visibility toast ---
  const setField = useCallback(
    (id: string, value: OfferValue) => {
      setWorking((prev) => {
        const next = { ...prev, [id]: value };
        for (const fid of CONDITIONAL_FIELD_IDS) {
          const had = !isNoValue(prev[fid]);
          const wasVisible = isFieldVisible(fid, prev);
          const nowVisible = isFieldVisible(fid, next);
          if (had && wasVisible && !nowVisible) {
            push(`${fieldsById[fid].label} hidden because ${visibilityReason(fid)}. Value kept.`, 'info');
          }
        }
        return next;
      });
      setSaveState(isDraft ? 'saving' : 'unsaved');
    },
    [isDraft, push],
  );

  const applyCombo = useCallback(
    (combo: OfferSetupCombo) => {
      setWorking((prev) => ({
        ...prev,
        kognitivActivationSetupType: combo.activationSetupType,
        kognitivOfferSetupType: combo.offerSetupType,
        optInMethod: combo.optInMethod,
      }));
      setSaveState(isDraft ? 'saving' : 'unsaved');
      push('Applied common setup. You can still change the values.', 'info');
    },
    [isDraft, push],
  );

  // A1: assign the auto-generated Offer ID on first save.
  const ensureId = useCallback(
    (w: OfferRecord): OfferRecord =>
      isNoValue(w.offerId) ? { ...w, offerId: nextOfferId() } : w,
    [nextOfferId],
  );

  // --- draft autosave (1s after last change) ---
  useEffect(() => {
    if (!isDraft || !working._uid || saveState !== 'saving') return;
    const t = setTimeout(() => {
      const toSave = ensureId(working);
      if (toSave !== working) setWorking(toSave);
      updateOffer(working._uid!, toSave);
      setSaveState('saved');
      setLastSavedAt(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
    }, 1000);
    return () => clearTimeout(t);
  }, [working, isDraft, saveState, updateOffer, ensureId]);

  // --- save changes (existing offers): one audit per changed field ---
  const commitChanges = useCallback(() => {
    if (!working._uid) return;
    const before = offers.find((o) => o._uid === working._uid);
    if (before) {
      for (const f of fields) {
        const a = before[f.id];
        const b = working[f.id];
        if (String(a ?? '') !== String(b ?? '')) {
          addAudit({
            offerId: String(working.offerId ?? ''),
            offerUid: working._uid,
            user: role,
            action: 'field changed',
            fieldLabel: f.label,
            oldValue: (a as OfferValue) ?? null,
            newValue: (b as OfferValue) ?? null,
          });
        }
      }
    }
    updateOffer(working._uid, working);
    setSaveState('saved');
    setLastSavedAt(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
    push('Changes saved.', 'success');
  }, [working, offers, updateOffer, addAudit, role, push]);

  const saveDraftNow = useCallback(() => {
    if (!working._uid) return;
    const toSave = ensureId(working);
    if (toSave !== working) setWorking(toSave);
    updateOffer(working._uid, toSave);
    setSaveState('saved');
    setLastSavedAt(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
    push('Draft saved', 'success');
  }, [working, updateOffer, push, ensureId]);

  // Ctrl/Cmd+S
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 's') {
        e.preventDefault();
        if (isDraft) saveDraftNow();
        else commitChanges();
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isDraft, saveDraftNow, commitChanges]);

  const submitOffer = useCallback(() => {
    const res = validateOffer(working, { allOffers: offers, categorySubCategory });
    if (res.errors.length > 0) {
      setStep(REVIEW);
      push(`Cannot submit: ${res.errors.length} error${res.errors.length === 1 ? '' : 's'} to fix.`, 'error');
      return;
    }
    const toSave = ensureId(working);
    if (toSave !== working) setWorking(toSave);
    updateOffer(working._uid!, toSave);
    changeStatus(working._uid!, 'Proposed', 'Submitted for approval');
    push('Offer submitted as Proposed', 'success');
  }, [working, offers, categorySubCategory, updateOffer, changeStatus, push, ensureId]);

  // --- lifecycle status change (owns `working`, commits + audits) ---
  const applyStatus = useCallback(
    (args: ApplyArgs) => {
      const uid = working._uid!;
      const prev = statusOf(working);
      // A4 Reopen: return a locked offer to its previous status.
      const to = args.reopen ? (working._prevStatus || 'Proposed') : args.to;
      const next: OfferRecord = { ...working, buildStatus: to, _prevStatus: prev, ...(args.extra ?? {}) };
      if (args.cancel) next.dateOfChangeCancel = todayISO();
      setWorking(next);
      updateOffer(uid, next);
      setSaveState('saved');
      addAudit({
        offerId: String(working.offerId ?? ''),
        offerUid: uid,
        user: role,
        action: args.cancel ? 'cancelled' : args.isApproval ? 'approved' : 'status changed',
        fieldLabel: 'Status',
        oldValue: prev,
        newValue: to,
        comment: args.reopen ? `Reopened: ${args.comment}` : args.comment || undefined,
      });
      if (args.cancel) push('Offer cancelled.', 'warning');
      else if (args.reopen) push(`Offer reopened to ${to}.`, 'info');
      else if (args.isApproval) push('Offer and forecast approved.', 'success');
      else push(`Status changed to ${to}.`, 'success');
    },
    [working, updateOffer, addAudit, role, push],
  );

  // --- SLA indicators (spec 7.2): 48h approval clock + 7-day Promo Advisor reminder ---
  function enteredStatusAt(st: string): string | null {
    const e = auditLog.find((a) => a.offerUid === working._uid && a.newValue === st);
    return e?.timestamp ?? working._updatedAt ?? null;
  }
  const waitingHours = useMemo(() => {
    if (status !== 'Proposed' && status !== 'Pending SteerCo Approval') return null;
    const since = enteredStatusAt(status);
    return since ? Math.max(0, (Date.now() - new Date(since).getTime()) / 3_600_000) : null;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, auditLog, working._uid]);
  const skuDueDate = useMemo(() => {
    if (status !== 'Planning Phase' || working.skuList === 'Yes') return null;
    const approved = enteredStatusAt('Planning Phase');
    const d = parseISO(approved ? approved.slice(0, 10) : '');
    if (!d) return null;
    return formatDate(new Date(d.getTime() + 7 * 86_400_000).toISOString().slice(0, 10));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, working.skuList, auditLog, working._uid]);

  // Steps include the Child promotions tab when Grouped Offer = Yes.
  const allSteps = useMemo(
    () =>
      isGroupedTabVisible(working)
        ? [...STEP_ORDER, GROUPED_TAB, REVIEW]
        : [...STEP_ORDER, REVIEW],
    [working],
  );

  // --- step statuses ---
  const stepInfos: StepInfo[] = useMemo(() => {
    return allSteps.map((name) => {
      if (name === GROUPED_TAB) {
        return { name, label: GROUPED_TAB, status: 'inProgress' as StepStatus, errorCount: 0 };
      }
      if (name === REVIEW) {
        const st: StepStatus =
          validation.errors.length > 0 ? 'errors' : 'complete';
        return { name, label: REVIEW, status: st, errorCount: validation.errors.length };
      }
      const stepFields = (fieldsByStep[name] ?? []).filter(
        (f) => f.control !== 'computed' && f.control !== 'hidden' && isFieldVisible(f.id, working),
      );
      const filled = stepFields.filter((f) => !isNoValue(working[f.id]) || working[f.id] === 'N/A');
      const stepErrors = validation.errors.filter((e) => fieldsById[e.fieldId]?.step === name);
      const requiredHere = stepFields.filter((f) => f.required);
      const requiredFilled = requiredHere.every((f) => !isNoValue(working[f.id]) && working[f.id] !== 'N/A');
      let st: StepStatus;
      if (stepErrors.length > 0) st = 'errors';
      else if (filled.length === 0) st = 'notStarted';
      else if (requiredHere.length > 0 && requiredFilled) st = 'complete';
      else if (requiredHere.length === 0 && filled.length > 0) st = 'complete';
      else st = 'inProgress';
      return { name, label: name, status: st, errorCount: stepErrors.length };
    });
  }, [working, validation, allSteps]);

  function jumpToField(fieldId: string) {
    const f = fieldsById[fieldId];
    if (f) {
      setStep(f.step);
      setTimeout(() => {
        const el = document.getElementById(`field-${fieldId}`);
        el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        (el as HTMLElement | null)?.focus?.();
      }, 60);
    }
  }

  function exportThis() {
    const cols = fields.filter((f) => f.control !== 'hidden');
    const headers = cols.map((f) => f.label);
    const row = cols.map((f) =>
      f.control === 'computed'
        ? String(computedFieldValue(f.id, working) ?? '')
        : String(working[f.id] ?? ''),
    );
    downloadCsv(`offer-${working.offerId || 'draft'}`, toCsv(headers, [row]));
    push('Offer exported to CSV.', 'success');
  }

  if (!offerId) return null; // redirecting to a new draft
  if (!stored) {
    return (
      <EmptyState
        title="Offer not found"
        message="This offer may have been deleted or the link is out of date."
        action={
          <button onClick={() => navigate('/')} className="rounded-md bg-primary px-3 py-1.5 text-white">
            Back to Offers
          </button>
        }
      />
    );
  }

  const slWarn = softLockWarning(working, softLockDate(working));
  const stepIndex = allSteps.indexOf(step);

  return (
    <div className="pb-20">
      {/* Header */}
      <div className="mb-4">
        {locked && (
          <div className="mb-2 flex items-center gap-2 rounded-md border border-slate-300 bg-slate-100 px-3 py-1.5 text-sm text-slate-700">
            <Lock size={15} /> This offer is locked because it is {status}. No changes can be made.
          </div>
        )}
        {readOnly && !locked && (
          <div className="mb-2 rounded-md border border-warning/40 bg-warning/5 px-3 py-1.5 text-sm text-warning">
            View only — this role cannot edit offers.
          </div>
        )}
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-semibold text-ink">
                {String(working.offerName || 'New offer')}
              </h1>
              <StatusPill status={status} />
              {locked && <TagPill kind="Locked" />}
            </div>
            <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted">
              <span className="inline-flex items-center gap-1.5">
                Offer ID:{' '}
                {isNoValue(working.offerId) ? (
                  <span className="italic">Assigned on first save</span>
                ) : (
                  <>
                    {String(working.offerId)} <TagPill kind="Auto-generated" />
                  </>
                )}
              </span>
              <span>
                {formatDate(working.startDate)} → {formatDate(working.endDate)}
              </span>
              <span>{isNoValue(working.country) ? '—' : String(working.country)}</span>
              <button
                onClick={() => navigate('/data-feed')}
                className="rounded-full border border-border px-2 py-0.5 text-xs text-muted hover:bg-surface"
                title="Databricks feed status — click to open the feed"
              >
                {feedChip(working, feedState[working._uid ?? '']?.loadedAt, categorySubCategory)}
              </button>
              <SaveIndicator state={saveState} lastSavedAt={lastSavedAt} isDraft={isDraft} />
            </div>
          </div>
          <div className="flex items-center gap-2">
            {canEdit && (
              <button
                onClick={() => {
                  const id = copyOffer(working._uid!);
                  if (id) {
                    push('Offer copied to a new draft.', 'success');
                    navigate(`/offers/${id}`);
                  }
                }}
                className="inline-flex items-center gap-1.5 rounded-md border border-border px-2.5 py-1.5 hover:bg-surface"
              >
                <Copy size={15} /> Copy
              </button>
            )}
            <button
              onClick={() => setHistoryOpen(true)}
              className="inline-flex items-center gap-1.5 rounded-md border border-border px-2.5 py-1.5 hover:bg-surface"
            >
              <HistoryIcon size={15} /> History
            </button>
            <button
              onClick={exportThis}
              className="inline-flex items-center gap-1.5 rounded-md border border-border px-2.5 py-1.5 hover:bg-surface"
            >
              <Download size={15} /> Export
            </button>
            {can(role, 'cancelOffer') && status !== 'Cancelled' && (
              <button
                onClick={() => setCancelOpen(true)}
                className="inline-flex items-center gap-1.5 rounded-md border border-danger/40 px-2.5 py-1.5 text-danger hover:bg-danger/5"
              >
                <XCircle size={15} /> Cancel offer
              </button>
            )}
            <DropdownMenu.Root>
              <DropdownMenu.Trigger asChild>
                <button className="rounded-md border border-border p-1.5 hover:bg-surface">
                  <MoreVertical size={16} />
                </button>
              </DropdownMenu.Trigger>
              <DropdownMenu.Portal>
                <DropdownMenu.Content align="end" className="z-50 min-w-[230px] rounded-md border border-border bg-white py-1 shadow-lg">
                  <DropdownMenu.Item onSelect={() => setSubmissionOpen(true)} className="flex cursor-pointer items-center gap-2 px-3 py-1.5 outline-none hover:bg-surface">
                    Generate submission form
                  </DropdownMenu.Item>
                  {isDraft && can(role, 'deleteDraft') && (
                    <>
                      <DropdownMenu.Separator className="my-1 h-px bg-border" />
                      <DropdownMenu.Item
                        onSelect={() => setDeleteOpen(true)}
                        className="flex cursor-pointer items-center gap-2 px-3 py-1.5 text-danger outline-none hover:bg-surface"
                      >
                        <Trash2 size={14} /> Delete draft
                      </DropdownMenu.Item>
                    </>
                  )}
                </DropdownMenu.Content>
              </DropdownMenu.Portal>
            </DropdownMenu.Root>
          </div>
        </div>

        {slWarn && (
          <div className="mt-2 flex items-center gap-2 rounded-md border border-warning/40 bg-warning/5 px-3 py-1.5 text-sm text-warning">
            <AlertTriangle size={15} /> {slWarn}
          </div>
        )}

        {/* SLA indicators (spec 7.2) */}
        {(waitingHours !== null || skuDueDate) && (
          <div className="mt-2 flex flex-wrap items-center gap-2">
            {waitingHours !== null && (
              <span
                className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-medium ${
                  waitingHours >= 48
                    ? 'border-danger/40 bg-danger/5 text-danger'
                    : waitingHours >= 24
                      ? 'border-warning/40 bg-warning/5 text-warning'
                      : 'border-border text-muted'
                }`}
                title="Approval SLA is 48 hours"
              >
                <Clock size={13} /> Waiting{' '}
                {waitingHours < 48 ? `${Math.round(waitingHours)} h` : `${Math.round(waitingHours / 24)} d`} · 48 h SLA
              </span>
            )}
            {skuDueDate && (
              <span className="inline-flex items-center gap-1 rounded-full border border-blue-200 bg-blue-50 px-2.5 py-0.5 text-xs font-medium text-blue-700" title="SKUs sent to Promo Advisor within 7 days of approval">
                <Clock size={13} /> SKUs to Promo Advisor due {skuDueDate}
              </span>
            )}
          </div>
        )}
      </div>

      {/* Lifecycle bar + status actions */}
      <LifecycleBar offer={working} onJump={jumpToField} onApply={applyStatus} />

      {/* Narrow-screen step selector (below 1280px the step nav collapses). */}
      <div className="mb-3 xl:hidden">
        <label className="sr-only" htmlFor="step-select">Step</label>
        <select
          id="step-select"
          className="w-full rounded-md border border-border px-3 py-2"
          value={step}
          onChange={(e) => setStep(e.target.value)}
        >
          {stepInfos.map((s) => (
            <option key={s.name} value={s.name}>
              {s.label}
              {s.status === 'errors' ? ` (${s.errorCount} error${s.errorCount === 1 ? '' : 's'})` : ''}
            </option>
          ))}
        </select>
      </div>

      {/* Body: step nav | form | right panel */}
      <div className="grid grid-cols-1 gap-5 xl:grid-cols-[200px_minmax(0,1fr)_320px]">
        <div className="sticky top-4 hidden self-start xl:block">
          <StepNav steps={stepInfos} current={step} onSelect={setStep} />
        </div>

        <div className="min-w-0">
          {step === GROUPED_TAB ? (
            <GroupedOfferTab offer={working} readOnly={readOnly} />
          ) : step === REVIEW ? (
            <ReviewStep working={working} onJump={jumpToField} errors={validation.errors} warnings={validation.warnings} />
          ) : (
            <StepForm
              step={step}
              working={working}
              setField={setField}
              readOnly={readOnly}
              errorByField={errorByField}
              warningByField={warningByField}
              dropdowns={dropdowns}
              categorySubCategory={categorySubCategory}
              onOpenSubmission={() => setSubmissionOpen(true)}
            />
          )}
        </div>

        <div className="min-w-0">
          <RightPanel
            offer={working}
            step={step}
            errors={validation.errors}
            warnings={validation.warnings}
            onJump={jumpToField}
            onApplyCombo={applyCombo}
          />
        </div>
      </div>

      {/* Sticky footer */}
      <div className="fixed bottom-0 left-60 right-0 border-t border-border bg-white px-6 py-3">
      {isDraft && validation.errors.length > 0 && (
        <p className="mb-2 text-xs text-warning">
          Saved as draft. Fix {validation.errors.length} item
          {validation.errors.length === 1 ? '' : 's'} before you can submit.
        </p>
      )}
      <div className="flex items-center justify-between">
        <button
          disabled={stepIndex === 0}
          onClick={() => setStep(allSteps[Math.max(0, stepIndex - 1)])}
          className="inline-flex items-center gap-1 rounded-md border border-border px-3 py-1.5 hover:bg-surface disabled:opacity-40"
        >
          <ChevronLeft size={15} /> Back
        </button>
        <div className="flex items-center gap-2">
          {canEdit && isDraft && (
            <button onClick={saveDraftNow} className="inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 hover:bg-surface">
              <Save size={15} /> Save draft
            </button>
          )}
          {canEdit && !isDraft && (
            <button
              onClick={commitChanges}
              disabled={saveState !== 'unsaved'}
              className="inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 hover:bg-surface disabled:opacity-40"
            >
              <Save size={15} /> Save changes
            </button>
          )}
          {step === REVIEW && isDraft && canEdit ? (
            <button onClick={submitOffer} className="inline-flex items-center gap-1.5 rounded-md bg-primary px-4 py-1.5 font-medium text-white hover:bg-primary/90">
              <Send size={15} /> Submit offer
            </button>
          ) : (
            <button
              disabled={stepIndex === allSteps.length - 1}
              onClick={() => setStep(allSteps[Math.min(allSteps.length - 1, stepIndex + 1)])}
              className="inline-flex items-center gap-1 rounded-md bg-primary px-3 py-1.5 text-white hover:bg-primary/90 disabled:opacity-40"
            >
              Next <ChevronRight size={15} />
            </button>
          )}
        </div>
      </div>
      </div>

      <HistoryDrawer
        offerUid={working._uid ?? null}
        offerName={String(working.offerName ?? working.offerId ?? '')}
        open={historyOpen}
        onOpenChange={setHistoryOpen}
      />
      <SubmissionFormDialog offers={[working]} open={submissionOpen} onClose={() => setSubmissionOpen(false)} />
      <ConfirmDialog
        open={cancelOpen}
        title="Cancel offer"
        description="The record is kept and shown as Cancelled."
        confirmLabel="Cancel offer"
        cancelLabel="Keep offer"
        destructive
        withInput
        inputLabel="Reason"
        inputRequired
        onConfirm={(reason) => {
          cancelOffer(working._uid!, reason);
          setWorking((w) => ({ ...w, buildStatus: 'Cancelled' }));
          push('Offer cancelled.', 'warning');
          setCancelOpen(false);
        }}
        onCancel={() => setCancelOpen(false)}
      />
      <ConfirmDialog
        open={deleteOpen}
        title="Delete draft"
        description="This permanently removes the draft. Submitted offers are cancelled, not deleted."
        confirmLabel="Delete draft"
        destructive
        onConfirm={() => {
          deleteOffer(working._uid!);
          push('Draft deleted.', 'info');
          navigate('/');
        }}
        onCancel={() => setDeleteOpen(false)}
      />
    </div>
  );
}

function SaveIndicator({ state, lastSavedAt, isDraft }: { state: SaveState; lastSavedAt: string; isDraft: boolean }) {
  if (state === 'saving') return <span className="text-muted">Saving…</span>;
  if (state === 'unsaved') return <span className="text-warning">Unsaved changes</span>;
  return (
    <span className="inline-flex items-center gap-1 text-success">
      <Check size={13} /> {isDraft ? 'All changes saved' : 'Saved'}
      {lastSavedAt ? ` ${lastSavedAt}` : ''}
    </span>
  );
}

function StepForm({
  step,
  working,
  setField,
  readOnly,
  errorByField,
  warningByField,
  dropdowns,
  categorySubCategory,
  onOpenSubmission,
}: {
  step: string;
  working: OfferRecord;
  setField: (id: string, v: OfferValue) => void;
  readOnly: boolean;
  errorByField: Record<string, string>;
  warningByField: Record<string, string>;
  dropdowns: Record<string, string[]>;
  categorySubCategory: import('@/lib/types').CategorySubCategory[];
  onOpenSubmission: () => void;
}) {
  const stepFields = (fieldsByStep[step] ?? []).filter(
    (f) => f.control !== 'hidden' && isFieldVisible(f.id, working),
  );

  // Render, grouping consecutive fields that share a `group`.
  const blocks: Array<{ group?: string; items: FieldDef[] }> = [];
  for (const f of stepFields) {
    const last = blocks[blocks.length - 1];
    if (f.group && last && last.group === f.group) last.items.push(f);
    else blocks.push({ group: f.group, items: [f] });
  }

  const phase2Disabled =
    'inline-flex cursor-not-allowed items-center gap-1.5 rounded-md border border-border px-2.5 py-1.5 text-sm text-muted opacity-70';

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-lg font-semibold text-ink">{step}</h2>
        <div className="flex flex-wrap items-center gap-2">
          {step === '6. Content, Signage & SKUs' && (
            <>
              <button onClick={onOpenSubmission} className="inline-flex items-center gap-1.5 rounded-md border border-border px-2.5 py-1.5 text-sm hover:bg-surface">
                Generate submission form <TagPill kind="MVP scope to confirm" />
              </button>
              <button disabled className={phase2Disabled} title="Integration approach to be decided">
                Open SKU List Uploader <PhaseBadge />
              </button>
            </>
          )}
          {step === '7. Forecast' && (
            <button disabled className={phase2Disabled} title="Confirmed for Phase 2, not MVP.">
              Pre-fill from Loyalty Offer Forecast data product <PhaseBadge note="Confirmed for Phase 2, not MVP." />
            </button>
          )}
          {step === '9. Results' && (
            <button disabled className={phase2Disabled}>
              Pull actuals from LOPD <PhaseBadge />
            </button>
          )}
        </div>
      </div>
      <div className="space-y-5">
        {blocks.map((block, i) =>
          block.group ? (
            <fieldset key={i} className="rounded-lg border border-border p-4">
              <legend className="px-1 text-sm font-semibold text-ink">{block.group}</legend>
              <div className="grid grid-cols-2 gap-4">
                {block.items.map((f) => (
                  <FieldCell
                    key={f.id}
                    field={f}
                    working={working}
                    setField={setField}
                    readOnly={readOnly}
                    error={errorByField[f.id]}
                    warning={warningByField[f.id]}
                    dropdowns={dropdowns}
                    categorySubCategory={categorySubCategory}
                  />
                ))}
              </div>
            </fieldset>
          ) : (
            block.items.map((f) => (
              <FieldCell
                key={f.id}
                field={f}
                working={working}
                setField={setField}
                readOnly={readOnly}
                error={errorByField[f.id]}
                warning={warningByField[f.id]}
                dropdowns={dropdowns}
                categorySubCategory={categorySubCategory}
              />
            ))
          ),
        )}
      </div>
    </div>
  );
}

function FieldCell({
  field,
  working,
  setField,
  readOnly,
  error,
  warning,
  dropdowns,
  categorySubCategory,
}: {
  field: FieldDef;
  working: OfferRecord;
  setField: (id: string, v: OfferValue) => void;
  readOnly: boolean;
  error?: string;
  warning?: string;
  dropdowns: Record<string, string[]>;
  categorySubCategory: import('@/lib/types').CategorySubCategory[];
}) {
  const options = optionsForField(
    field.id,
    field.optionsKey,
    dropdowns,
    categorySubCategory,
    working.category,
  );
  const computedValue =
    field.control === 'computed' ? (computedFieldValue(field.id, working) as string | number | null) : undefined;

  return (
    <FieldRenderer
      field={field}
      value={working[field.id]}
      onChange={(v) => {
        // When Category changes, clear Sub-Category (cascading parent change).
        if (field.id === 'category') setField('subCategory', '');
        setField(field.id, v);
      }}
      disabled={readOnly}
      computedValue={computedValue}
      options={options}
      error={error}
      warning={warning}
    />
  );
}

function ReviewStep({
  working,
  onJump,
  errors,
  warnings,
}: {
  working: OfferRecord;
  onJump: (id: string) => void;
  errors: import('@/lib/validation').Issue[];
  warnings: import('@/lib/validation').Issue[];
}) {
  return (
    <div>
      <h2 className="mb-4 text-lg font-semibold text-ink">Review</h2>
      <div className="mb-5 rounded-lg border border-border bg-white p-4">
        <h3 className="mb-2 font-semibold">Validation</h3>
        <ValidationSummary errors={errors} warnings={warnings} onJump={onJump} />
      </div>
      {STEP_ORDER.map((stepName) => {
        const stepFields = (fieldsByStep[stepName] ?? []).filter(
          (f) => f.control !== 'hidden' && isFieldVisible(f.id, working),
        );
        return (
          <div key={stepName} className="mb-5">
            <h3 className="mb-2 font-semibold text-ink">{stepName}</h3>
            <dl className="grid grid-cols-2 gap-x-6 gap-y-1 rounded-lg border border-border bg-white p-4 text-sm">
              {stepFields.map((f) => {
                const v =
                  f.control === 'computed'
                    ? computedFieldValue(f.id, working)
                    : working[f.id];
                return (
                  <div key={f.id} className="flex justify-between gap-3 border-b border-border/50 py-1">
                    <dt className="text-muted">{f.label}</dt>
                    <dd className="text-right text-ink">
                      {isNoValue(v) ? (v === 'N/A' ? 'N/A' : '—') : String(v)}
                    </dd>
                  </div>
                );
              })}
            </dl>
          </div>
        );
      })}
    </div>
  );
}

