export const SUBMISSION_MEMBER_STAGE_FLOW = [
  { key: 'received', label: 'Received' },
  { key: 'acknowledged', label: 'Acknowledged' },
  { key: 'reviewing', label: 'Reviewing' },
  { key: 'accepted', label: 'Accepted' },
  { key: 'producing', label: 'Preparing entry' },
  { key: 'preflight', label: 'Preflight' },
  { key: 'in_library', label: 'In library' },
];

function isObject(value) {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function text(value, fallback = '', max = 4000) {
  const normalized = String(value ?? '').replace(/\s+/g, ' ').trim();
  return normalized ? normalized.slice(0, max) : fallback;
}

function firstText(values, fallback = '', max = 4000) {
  for (const value of values) {
    const normalized = text(value, '', max);
    if (normalized) return normalized;
  }
  return fallback;
}

function metadataOf(value) {
  if (isObject(value?.metadata)) return value.metadata;
  if (isObject(value?.meta)) return value.meta;
  const raw = value?.metadata_json || value?.metadataJson;
  if (isObject(raw)) return raw;
  if (typeof raw !== 'string' || !raw.trim()) return {};
  try {
    const parsed = JSON.parse(raw);
    return isObject(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

export function normalizeSubmissionActor(value) {
  const normalized = text(value, '').toLowerCase();
  if (['member', 'user', 'customer', 'submitter'].includes(normalized)) return 'user';
  if (['staff', 'admin', 'operator'].includes(normalized) || normalized.includes('staff')) return 'staff';
  if (!normalized || normalized === 'system') return 'system';
  return 'user';
}

export function normalizeSubmissionStage(value) {
  const normalized = text(value, '').toLowerCase();
  if (/in.?library|released|published/.test(normalized)) return 'in_library';
  if (/preflight|ready.?to.?publish/.test(normalized)) return 'preflight';
  if (/produc|preparing.?entry|adding.?files/.test(normalized)) return 'producing';
  if (/reject|declin/.test(normalized)) return 'rejected';
  if (/revision|need.?info/.test(normalized)) return 'revision_requested';
  if (/accept|approv/.test(normalized)) return 'accepted';
  if (/review/.test(normalized)) return 'reviewing';
  if (/acknowledg/.test(normalized)) return 'acknowledged';
  if (/receiv|sent|submit/.test(normalized)) return 'received';
  return normalized || 'reviewing';
}

export function submissionStageLabel(stage) {
  const normalized = normalizeSubmissionStage(stage);
  const found = SUBMISSION_MEMBER_STAGE_FLOW.find((item) => item.key === normalized);
  if (found) return found.label;
  if (normalized === 'revision_requested') return 'Revisions requested';
  if (normalized === 'rejected') return 'Not selected';
  return normalized.replace(/_/g, ' ');
}

function fallbackPresentation(eventType, actorType, actorLabel, lookup, link) {
  const fallback = {
    sent: ['Submission sent', 'Your submission was sent successfully. Dex will confirm it when it reaches the review queue.', 'system'],
    received: ['Submission received', 'Dex received your submission and placed it in the editorial review queue. You can reply here if you need to add context.', 'system'],
    lookup_generated: [
      lookup ? `Reference ${lookup}` : 'Submission reference generated',
      lookup
        ? `Dex automatically generated ${lookup} for this submission. Keep this number handy when contacting us about the work.`
        : 'Dex generated a reference for this submission. The final number will appear here when it is available.',
      'system',
    ],
    lookup_finalized: [
      lookup ? `Reference finalized: ${lookup}` : 'Submission reference finalized',
      lookup ? `${lookup} is now the final reference for this submission and its library entry.` : 'The final submission reference has been confirmed.',
      'system',
    ],
    acknowledged: [
      'Acknowledged by the Dex team',
      `${actorLabel === 'Member' ? 'The Dex team' : actorLabel} confirmed that your submission is ready for editorial review. Next, we will review the work and contact you if we need files or additional context.`,
      'staff',
    ],
    reviewing: ['Editorial review in progress', 'The Dex team is reviewing the work, metadata, and files. We will post the decision or any requested changes here.', 'staff'],
    revision_requested: ['Revision requested', 'The Dex team needs an update before making a final decision. Review the details below and reply here when the revision is ready.', 'warning'],
    accepted: ['Accepted', 'Congratulations — your submission has been accepted for the Dex library. We will now prepare the entry and its files; it is not public yet.', 'success'],
    producing: ['Preparing your entry', 'The Dex team is building your library entry, finalizing its reference, metadata, and downloadable files. It is not public yet.', 'staff'],
    preflight: ['Ready for publication', 'Your entry is complete and has passed Dex preflight checks. It is queued for publication, but it is not live yet.', 'success'],
    in_library: [
      'Now in the Dex library',
      lookup ? `Congratulations — your entry is live in the Dex library under ${lookup}.` : 'Congratulations — your entry is now live in the Dex library.',
      'success',
    ],
    rejected: ['Editorial decision', 'The Dex team is not moving this submission into the library at this time. Any specific feedback appears below.', 'warning'],
    user_acknowledged: ['Update read', 'You acknowledged this submission update.', 'member'],
  };
  const selected = fallback[eventType] || ['Submission update', 'Dex recorded an update on this submission.', 'system'];
  return {
    title: selected[0],
    body: selected[1],
    actorLabel,
    tone: selected[2],
    link: eventType === 'in_library' && link ? { href: link, label: 'Open your library entry' } : null,
  };
}

export function normalizeSubmissionTimelineEvent(row, index = 0, context = {}) {
  const value = isObject(row) ? row : {};
  const metadata = metadataOf(value);
  const eventType = text(value.eventType || value.event_type || value.stage || value.statusRaw || value.status_raw, '').toLowerCase();
  const actorType = normalizeSubmissionActor(value.actorType || value.actor_type || value.author);
  const actorLabel = firstText([
    value.presentation?.actorLabel,
    value.presentation?.actor_label,
    metadata.actorLabel,
    metadata.actor_label,
    actorType === 'user' ? 'Member' : actorType === 'staff' ? value.actorId || value.actor_id : 'Dex',
  ], actorType === 'user' ? 'Member' : actorType === 'staff' ? 'Dex team' : 'Dex', 120);
  const lookup = firstText([
    metadata.finalLookupNumber,
    metadata.final_lookup_number,
    metadata.submissionLookupGenerated,
    metadata.submission_lookup_generated,
    metadata.lookup,
    value.lookup,
    context.lookup,
  ], '', 240);
  const link = firstText([
    value.presentation?.link?.href,
    value.libraryHref,
    value.library_href,
    metadata.entryHref,
    metadata.entry_href,
    metadata.libraryHref,
    metadata.library_href,
    context.libraryHref,
  ], '', 1200);
  const explicitBody = firstText([
    value.presentation?.body,
    value.publicNote,
    value.public_note,
    value.body,
    value.message,
  ], '', 4000);
  let presentation;
  if (eventType === 'public_note') {
    presentation = {
      title: actorType === 'user' ? 'Your message' : 'Message from the Dex team',
      body: explicitBody,
      actorLabel,
      tone: actorType === 'user' ? 'member' : actorType === 'staff' ? 'staff' : 'system',
      link: null,
    };
  } else {
    const fallback = fallbackPresentation(eventType, actorType, actorLabel, lookup, link);
    presentation = {
      title: firstText([value.presentation?.title], fallback.title, 240),
      body: explicitBody || fallback.body,
      actorLabel,
      tone: firstText([value.presentation?.tone], fallback.tone, 40),
      link: link
        ? {
            href: link,
            label: firstText([value.presentation?.link?.label], eventType === 'in_library' ? 'Open your library entry' : 'Open link', 120),
          }
        : fallback.link,
    };
  }
  return {
    id: firstText([value.id], `timeline-${index + 1}`, 160),
    eventType,
    actorType,
    actorLabel,
    statusRaw: firstText([value.statusRaw, value.status_raw], '', 240),
    createdAt: firstText([value.eventAt, value.event_at, value.createdAt, value.created_at], '', 120),
    link,
    lookup,
    metadata,
    presentation,
    note: presentation.body,
  };
}
