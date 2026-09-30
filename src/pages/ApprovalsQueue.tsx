import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Clock, Check, Undo2, ExternalLink } from 'lucide-react';
import { useAppStore } from '@/store/useAppStore';
import { useToasts } from '@/store/useToasts';
import { PageHeader } from '@/components/PageHeader';
import { EmptyState } from '@/components/EmptyState';
import { StatusPill } from '@/components/StatusPill';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { computeForecast, forecastNeeded, softLockDate } from '@/lib/calculations';
import { formatCurrency, formatNumber, formatDate } from '@/lib/format';
import { can } from '@/lib/permissions';
import type { OfferRecord, AuditEntry } from '@/lib/types';

const APPROVAL_STATUSES = ['Proposed', 'Pending SteerCo Approval'];

/** Hours the offer has been waiting in its current status. */
function waitingHours(offer: OfferRecord, auditLog: AuditEntry[]): number | null {
  const entered = auditLog.find(
    (a) => a.offerUid === offer._uid && (a.newValue === offer.buildStatus || a.action === 'imported'),
  );
  const since = entered?.timestamp ?? offer._updatedAt;
  if (!since) return null;
  return Math.max(0, (Date.now() - new Date(since).getTime()) / 3_600_000);
}

function waitingLabel(h: number | null): { text: string; cls: string } {
  if (h === null) return { text: '—', cls: 'text-muted' };
  const text = h < 48 ? `${Math.round(h)} h` : `${Math.round(h / 24)} d`;
  const cls = h >= 48 ? 'text-danger font-medium' : h >= 24 ? 'text-warning font-medium' : 'text-muted';
  return { text, cls };
}

function forecastEntered(o: OfferRecord): boolean {
  return (
    o.activationByDayLow != null && o.activationByDayLow !== '' &&
    o.activationByDayHigh != null && o.activationByDayHigh !== '' &&
    o.bonusRateLow != null && o.bonusRateLow !== '' &&
    o.bonusRateHigh != null && o.bonusRateHigh !== ''
  );
}

export function ApprovalsQueue() {
  const navigate = useNavigate();
  const offers = useAppStore((s) => s.offers);
  const auditLog = useAppStore((s) => s.auditLog);
  const role = useAppStore((s) => s.role);
  const updateOffer = useAppStore((s) => s.updateOffer);
  const changeStatus = useAppStore((s) => s.changeStatus);
  const addAudit = useAppStore((s) => s.addAudit);
  const push = useToasts((s) => s.push);

  const [returnUid, setReturnUid] = useState<string | null>(null);
  const canApprove = can(role, 'approve');

  const queue = useMemo(
    () => offers.filter((o) => APPROVAL_STATUSES.includes(String(o.buildStatus))),
    [offers],
  );

  function approve(o: OfferRecord) {
    if (!(forecastEntered(o) || forecastNeeded(o) === 'No')) {
      push('Enter the forecast (Activation/day and Bonus rate Low & High) before approving.', 'error');
      return;
    }
    updateOffer(o._uid!, { buildStatus: 'Planning Phase' });
    addAudit({
      offerId: String(o.offerId ?? ''),
      offerUid: o._uid,
      user: role,
      action: 'approved',
      fieldLabel: 'Status',
      oldValue: String(o.buildStatus),
      newValue: 'Planning Phase',
      comment: `Approved by ${role}`,
    });
    push('Offer and forecast approved. Moved to Planning Phase.', 'success');
  }

  const returnOffer = offers.find((o) => o._uid === returnUid);

  return (
    <div>
      <PageHeader title="Approvals" count={queue.length} />
      {!canApprove && (
        <div className="mb-3 rounded-md border border-border bg-white px-3 py-2 text-sm text-muted">
          Read-only — only Approver (TBC) and Admin can approve or return offers.
        </div>
      )}

      {queue.length === 0 ? (
        <EmptyState title="Nothing awaiting approval." message="Offers in Proposed or Pending SteerCo Approval appear here." />
      ) : (
        <div className="overflow-x-auto rounded-lg border border-border bg-white">
          <table className="w-full whitespace-nowrap text-left text-sm">
            <thead className="border-b border-border bg-surface text-muted">
              <tr>
                <th className="px-3 py-2 font-medium">Offer ID</th>
                <th className="px-3 py-2 font-medium">Name</th>
                <th className="px-3 py-2 font-medium">Status</th>
                <th className="px-3 py-2 font-medium">Start</th>
                <th className="px-3 py-2 font-medium">Soft Lock</th>
                <th className="px-3 py-2 font-medium">Tier</th>
                <th className="px-3 py-2 text-right font-medium">Fcst activations (avg)</th>
                <th className="px-3 py-2 text-right font-medium">Fcst bonus pts (avg)</th>
                <th className="px-3 py-2 text-right font-medium">Redeemable $ (avg)</th>
                <th className="px-3 py-2 font-medium">Submitted By</th>
                <th className="px-3 py-2 font-medium">Waiting</th>
                <th className="px-3 py-2 font-medium" />
              </tr>
            </thead>
            <tbody>
              {queue.map((o) => {
                const f = computeForecast(o);
                const w = waitingLabel(waitingHours(o, auditLog));
                return (
                  <tr key={o._uid} className="border-b border-border last:border-0 hover:bg-surface/50">
                    <td className="px-3 py-2 tabular-nums">{String(o.offerId ?? '—')}</td>
                    <td className="px-3 py-2">
                      <button onClick={() => navigate(`/offers/${o._uid}`)} className="font-medium text-primary hover:underline">
                        {String(o.offerName ?? '(unnamed)')}
                      </button>
                    </td>
                    <td className="px-3 py-2"><StatusPill status={String(o.buildStatus)} /></td>
                    <td className="px-3 py-2">{formatDate(o.startDate)}</td>
                    <td className="px-3 py-2">{softLockDate(o)}</td>
                    <td className="px-3 py-2">{String(o.offerTiering ?? '—')}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{f.activationAvg === null ? '—' : formatNumber(f.activationAvg)}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{f.bonusPointsAvg === null ? '—' : formatNumber(f.bonusPointsAvg)}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{f.bonusRedeemableAvg === null ? '—' : formatCurrency(f.bonusRedeemableAvg)}</td>
                    <td className="px-3 py-2">{String(o.submittedBy ?? '—')}</td>
                    <td className={`px-3 py-2 ${w.cls}`}>
                      <span className="inline-flex items-center gap-1"><Clock size={13} /> {w.text}</span>
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex items-center gap-1.5">
                        <button onClick={() => navigate(`/offers/${o._uid}`)} className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 text-xs hover:bg-surface">
                          <ExternalLink size={13} /> Open
                        </button>
                        {canApprove && (
                          <>
                            <button onClick={() => approve(o)} className="inline-flex items-center gap-1 rounded-md bg-primary px-2 py-1 text-xs font-medium text-white hover:bg-primary/90">
                              <Check size={13} /> Approve
                            </button>
                            <button onClick={() => setReturnUid(o._uid!)} className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 text-xs hover:bg-surface">
                              <Undo2 size={13} /> Return
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <ConfirmDialog
        open={returnUid !== null}
        title="Return for changes"
        description={`Send "${returnOffer?.offerName ?? ''}" back to the team as Proposed.`}
        confirmLabel="Return for changes"
        withInput
        inputLabel="Comment"
        inputRequired
        inputPlaceholder="What needs to change?"
        onConfirm={(comment) => {
          if (returnUid) {
            changeStatus(returnUid, 'Proposed', comment);
            push('Offer returned for changes.', 'info');
          }
          setReturnUid(null);
        }}
        onCancel={() => setReturnUid(null)}
      />
    </div>
  );
}
