import { animate } from 'framer-motion/dom';

(() => {
  if (typeof window === 'undefined') return;
  if (window.__dxSubmitSamplesRuntimeLoaded) {
    if (typeof window.__dxSubmitSamplesMount === 'function') {
      try {
        window.__dxSubmitSamplesMount();
      } catch {}
    }
    return;
  }
  window.__dxSubmitSamplesRuntimeLoaded = true;

  const FETCH_STATE_LOADING = 'loading';
  const FETCH_STATE_READY = 'ready';
  const FETCH_STATE_ERROR = 'error';
  const DX_MIN_SHEEN_MS = 120;
  const AUTH_TIMEOUT_MS = 3200;
  const TOKEN_TIMEOUT_MS = 2600;
  const SUBMIT_TIMEOUT_MS = 15000;
  const SUBMIT_QUOTA_VERIFY_TIMEOUT_MS = 8000;
  const SUBMIT_MIN_LOADING_MS = 420;
  const ACHIEVEMENTS_REFRESH_TIMEOUT_MS = 5000;
  const WORKER_TIMEOUT_MS = 8000;
  const PREFETCH_SWR_MS = 60000;
  const QUOTA_RETRY_DELAY_MS = 220;
  const DEFAULT_API = 'https://dex-api.spring-fog-8edd.workers.dev';
  const DEFAULT_WEEKLY_LIMIT = 4;
  const DEFAULT_FLOW = 'sample';
  const FLOW_SAMPLE = 'sample';
  const FLOW_CALL = 'call';
  const CALL_SCHEMA_URL = '/data/submit.call.schema.json';
  const CALLS_REGISTRY_URL = '/data/calls.registry.json';
  const LANE_IDS = new Set(['in-dex-a', 'in-dex-b', 'in-dex-c', 'mini-dex']);
  const SUBCALL_IDS = new Set(['a', 'b', 'c']);

  const DEFAULT_CALL_SCHEMA = {
    version: 1,
    lanes: [
      {
        id: 'in-dex-a',
        label: 'IN DEX A',
        helper: 'Commissioned performance/proposal calls.',
        fields: [
          {
            key: 'callSubcall',
            label: 'Subcall',
            type: 'select',
            required: true,
            options: [
              { value: 'a', label: 'A.a Talks + discussions' },
              { value: 'b', label: 'A.b Acts' },
              { value: 'c', label: 'A.c Vendors' },
            ],
          },
          {
            key: 'proposalFormat',
            label: 'Proposal format',
            type: 'select',
            required: true,
            options: [
              { value: 'talk', label: 'Talk / panel' },
              { value: 'act', label: 'Performance / act' },
              { value: 'vendor', label: 'Vendor / installation' },
            ],
          },
          { key: 'runtimeMinutes', label: 'Runtime minutes', type: 'number', required: false, min: 1, max: 180 },
          { key: 'availabilityWindow', label: 'Availability window', type: 'text', required: false, maxLength: 120 },
          { key: 'portfolioUrl', label: 'Portfolio URL', type: 'url', required: false, maxLength: 600 },
        ],
      },
      {
        id: 'in-dex-b',
        label: 'IN DEX B',
        helper: 'Culling/composite/edit-oriented contribution calls.',
        fields: [
          {
            key: 'proposalFormat',
            label: 'Proposal format',
            type: 'select',
            required: true,
            options: [
              { value: 'edit', label: 'Edit/composite proposal' },
              { value: 'cull', label: 'Cull + sequence proposal' },
            ],
          },
          { key: 'runtimeMinutes', label: 'Runtime minutes', type: 'number', required: true, min: 1, max: 240 },
          { key: 'availabilityWindow', label: 'Availability window', type: 'text', required: false, maxLength: 120 },
          { key: 'portfolioUrl', label: 'Portfolio URL', type: 'url', required: false, maxLength: 600 },
        ],
      },
      {
        id: 'in-dex-c',
        label: 'IN DEX C',
        helper: 'Community feedback, polls, and forum collaboration.',
        fields: [
          {
            key: 'proposalFormat',
            label: 'Contribution mode',
            type: 'select',
            required: true,
            options: [
              { value: 'poll', label: 'Poll contribution' },
              { value: 'forum', label: 'Forum moderation / response' },
              { value: 'feedback', label: 'Feedback thread' },
            ],
          },
          { key: 'availabilityWindow', label: 'Availability window', type: 'text', required: true, maxLength: 120 },
          { key: 'portfolioUrl', label: 'Reference URL', type: 'url', required: false, maxLength: 600 },
        ],
      },
      {
        id: 'mini-dex',
        label: 'MINI-DEX',
        helper: 'Short volunteer call entries with quick turnaround.',
        fields: [
          {
            key: 'proposalFormat',
            label: 'Contribution format',
            type: 'select',
            required: true,
            options: [
              { value: 'field-recording', label: 'Field recording' },
              { value: 'voice-note', label: 'Voice note / spoken' },
              { value: 'other', label: 'Other material' },
            ],
          },
          { key: 'runtimeMinutes', label: 'Runtime minutes', type: 'number', required: false, min: 1, max: 30 },
          { key: 'portfolioUrl', label: 'Reference URL', type: 'url', required: false, maxLength: 600 },
        ],
      },
    ],
    limits: {
      proposalFormat: 80,
      runtimeMinutes: 240,
      availabilityWindow: 120,
      portfolioUrl: 600,
      notes: 2000,
    },
  };

  const STEPS = [
    { key: 'compose', title: 'Compose Submission', short: 'Compose' },
    { key: 'send', title: 'Rights + Send', short: 'Send' },
    { key: 'done', title: 'Submission Complete', short: 'Done' },
  ];
  const STEP_COMPOSE = 0;
  const STEP_SEND = 1;
  const STEP_DONE = 2;

  const CATEGORY_OPTIONS = [
    '',
    'V - Voice + Body',
    'K - Keyboards',
    'B - Brass',
    'E - Electronics',
    'S - Strings',
    'W - Winds',
    'P - Percussion',
    'X - Other',
  ];

  const COLLECTION_OPTIONS = [
    { value: 'V', label: 'Video' },
    { value: 'A', label: 'Audio' },
    { value: 'AV', label: 'Audio-visual' },
    { value: 'O', label: 'Other' },
  ];

  const OUTPUT_OPTIONS = [
    { value: '1080p', label: '1080p video' },
    { value: '4K', label: '4K video' },
    { value: 'ste', label: 'Stereo audio' },
    { value: '4ch', label: '4-channel audio' },
  ];

  const SERVICE_OPTIONS = [
    {
      value: 'chop',
      label: 'Section chops (A–E buckets)',
      locked: true,
      tooltip: 'We split your piece into labelled sections (A–E, plus X) so it is searchable and release-ready in the library.',
    },
    {
      value: 'credits',
      label: 'Dex credits card',
      locked: true,
      tooltip: 'Adds the standard Dex attribution card and your contribution metadata to the public release.',
    },
    {
      value: 'render',
      label: 'Preview copies (1080p / MP3)',
      locked: true,
      tooltip: 'Creates lightweight preview/accessibility versions while preserving your source masters.',
    },
    {
      value: 'grade',
      label: 'Color grading',
      tooltip: 'Shot-to-shot color balancing and tonal matching for publication consistency.',
    },
    {
      value: 'mix',
      label: 'Mixing',
      tooltip: 'Balance and cleanup pass across stems/channels for release-ready intelligibility.',
    },
    {
      value: 'master',
      label: 'Mastering',
      tooltip: 'Final loudness, spectral, and dynamics polish for distribution targets.',
    },
    {
      value: 'extra',
      label: 'Other edits (notes)',
      tooltip: 'Custom requests described in notes: alt cuts, trims, or direction-specific revisions.',
    },
  ];

  const LICENSE_OPTIONS = [
    {
      id: 'joint',
      label: 'Joint CC-BY 4.0',
      summary: 'Dex can transform a library-ready copy; you keep your original rights.',
      copy: `Joint CC-BY 4.0 License Agreement\n\nBy selecting Joint CC-BY 4.0, you grant Dex a perpetual, worldwide, non-exclusive license to transform, remix, and redistribute a library-ready copy of your submission under CC-BY 4.0. You retain full ownership of the original. Downstream users must attribute you as entered in Creator.\n\nFull legal code:\nhttps://creativecommons.org/licenses/by/4.0/legalcode`,
    },
    {
      id: 'cc-by',
      label: 'CC-BY 4.0 (submitter-only)',
      summary: 'Dex hosts the file as submitted, without transformations.',
      copy: `CC-BY 4.0 (Submitter-Only) License Agreement\n\nBy selecting CC-BY 4.0 (Submitter-Only), you license Dex to host your submission exactly as provided. You retain all rights. Downstream users may use and adapt under CC-BY with mandatory attribution.\n\nFull legal code:\nhttps://creativecommons.org/licenses/by/4.0/legalcode`,
    },
    {
      id: 'cc0',
      label: 'CC0 (Public Domain)',
      summary: 'Waives rights for unrestricted public-domain usage.',
      copy: `CC0 1.0 Universal Public Domain Dedication\n\nBy selecting CC0, you waive copyright and related rights worldwide. Dex and all users may use, modify, and distribute your file without attribution or restriction.\n\nFull text:\nhttps://creativecommons.org/publicdomain/zero/1.0/legalcode`,
    },
  ];

  const KEY_CENTER_OPTIONS = [
    'C',
    'C♯/D♭',
    'D',
    'D♯/E♭',
    'E',
    'F',
    'F♯/G♭',
    'G',
    'G♯/A♭',
    'A',
    'A♯/B♭',
    'B',
  ];

  const KEY_CENTER_24_TET_OPTIONS = [
    'C',
    'C quarter-sharp',
    'C♯/D♭',
    'D quarter-flat',
    'D',
    'D quarter-sharp',
    'D♯/E♭',
    'E quarter-flat',
    'E',
    'E quarter-sharp',
    'F',
    'F quarter-sharp',
    'F♯/G♭',
    'G quarter-flat',
    'G',
    'G quarter-sharp',
    'G♯/A♭',
    'A quarter-flat',
    'A',
    'A quarter-sharp',
    'A♯/B♭',
    'B quarter-flat',
    'B',
    'B quarter-sharp',
  ];

  const PITCH_SYSTEM_OPTIONS = [
    { value: '12-tet', label: '12-TET' },
    { value: '24-tet', label: '24-TET' },
    { value: 'ji', label: 'Just Intonation (JI)' },
    { value: 'atonal', label: 'Atonal' },
    { value: 'non-pitched', label: 'Non-pitched' },
  ];

  const PITCH_DESCRIPTOR_HINTS = {
    ji: 'Examples: 5/4 on C, 7/4 on D, 11-limit drone on A',
  };

  const TAG_HINT =
    'Met, Fre, Perc, Sus, Cle, Dis, Mono, Poly, Lou, Qui, Med, Bra, Exc, Sta, Sho, Lon, Oth, Ow, Mid, Hi, Spa';

  // Common scale qualities for the scale-quality combobox (free entry still allowed).
  const SCALE_QUALITY_SUGGESTIONS = [
    'major', 'minor', 'dorian', 'phrygian', 'lydian', 'mixolydian', 'locrian',
    'harmonic minor', 'melodic minor', 'pentatonic', 'blues', 'whole-tone',
    'chromatic', 'modal', 'maqam', 'raga', 'octatonic', 'microtonal', 'atonal',
  ];

  // Faceted tag vocabulary. `code` is committed to meta.tags (preserves the
  // existing short-code CSV contract); `label` is shown to the contributor.
  const TAG_VOCAB = [
    { facet: 'Timbre', items: [
      { code: 'Met', label: 'Metallic' }, { code: 'Bra', label: 'Bright' },
      { code: 'Cle', label: 'Clean' }, { code: 'Dis', label: 'Distorted' },
      { code: 'Fre', label: 'Resonant' }, { code: 'Perc', label: 'Percussive' },
    ] },
    { facet: 'Texture', items: [
      { code: 'Mono', label: 'Monophonic' }, { code: 'Poly', label: 'Polyphonic' },
      { code: 'Sus', label: 'Sustained' }, { code: 'Sta', label: 'Staccato' },
      { code: 'Exc', label: 'Excited' },
    ] },
    { facet: 'Dynamics', items: [
      { code: 'Lou', label: 'Loud' }, { code: 'Qui', label: 'Quiet' },
      { code: 'Med', label: 'Medium' },
    ] },
    { facet: 'Register', items: [
      { code: 'Hi', label: 'High' }, { code: 'Mid', label: 'Mid' }, { code: 'Ow', label: 'Low' },
    ] },
    { facet: 'Length', items: [
      { code: 'Sho', label: 'Short' }, { code: 'Lon', label: 'Long' },
    ] },
    { facet: 'Space', items: [
      { code: 'Spa', label: 'Spacious' }, { code: 'Oth', label: 'Other' },
    ] },
  ];
  const TAG_CODE_TO_LABEL = TAG_VOCAB.reduce((acc, facet) => {
    facet.items.forEach((item) => { acc[item.code.toLowerCase()] = item.label; });
    return acc;
  }, {});

  const STEP_GUIDANCE = {
    compose: 'Add the essentials, paste your source link, and open Advanced for tuning, tags, and production extras.',
    send: 'Choose your licensing mode, confirm rights, sign, and send.',
    done: 'Track status in your inbox submission timeline.',
  };

  const FIELD_GUIDANCE = {
    title: {
      title: 'Title guidance',
      body:
        'Use a searchable working title that names instrument and technique. This becomes part of review and timeline context.',
    },
    creator: {
      title: 'Creator guidance',
      body:
        'List credited performers exactly as they should appear publicly. Submission lookup performer token still comes from your account surname.',
    },
    callLane: {
      title: 'Call lane guidance',
      body: 'Choose the lane matching this proposal. Lane selection drives queue routing and reviewer context.',
    },
    callSubcall: {
      title: 'Subcall guidance',
      body: 'IN DEX A requires subcall selection (A.a, A.b, or A.c) so the proposal reaches the correct panel.',
    },
    proposalFormat: {
      title: 'Proposal format guidance',
      body: 'Specify the proposal format clearly to reduce follow-up cycles and speed assignment.',
    },
    runtimeMinutes: {
      title: 'Runtime guidance',
      body: 'When applicable, provide realistic runtime in minutes for scheduling and review planning.',
    },
    availabilityWindow: {
      title: 'Availability guidance',
      body: 'Share a clear availability window so call scheduling can proceed without additional back-and-forth.',
    },
    portfolioUrl: {
      title: 'Reference guidance',
      body: 'Optional but useful: add a relevant portfolio/reference link that helps adjudicators evaluate fit.',
    },
    callCycle: {
      title: 'Call cycle guidance',
      body: 'Cycle is prefilled from deep links when available. Keep it aligned with the active call window.',
    },
    category: {
      title: 'Category guidance',
      body: 'Choose the closest instrument family code. It sets the lookup instrument type prefix.',
    },
    instrument: {
      title: 'Instrument guidance',
      body:
        'Use specific instrument wording. The first three alphabetic letters become the instrument token in generated submission lookup.',
    },
    bpm: {
      title: 'Tempo guidance',
      body: 'Optional. Add BPM when pulse matters for catalog filtering and downstream production use.',
    },
    pitchSystem: {
      title: 'Pitch system guidance',
      body: 'Select 12-TET, 24-TET, JI, atonal, or non-pitched. This drives key-center serialization.',
    },
    pitchDescriptor: {
      title: 'Pitch descriptor guidance',
      body:
        'For 12-TET and 24-TET choose a root; for JI provide ratio/reference. Atonal and non-pitched skip descriptor.',
    },
    scaleQuality: {
      title: 'Scale quality guidance',
      body: 'Optional context like major, modal, maqam, raga, or other tonal system details.',
    },
    tags: {
      title: 'Tag guidance',
      body: 'Use concise comma-separated tags for articulation, dynamics, space, and usage cues.',
    },
    collectionType: {
      title: 'Collection type guidance',
      body:
        'Audio, Video, Audio-visual, or Other. Type plus year becomes the TypeYear suffix in generated lookup.',
    },
    outputTypes: {
      title: 'Output guidance',
      body:
        'Choose desired publish renditions. Keep this aligned with what your source actually supports to reduce revision loops.',
    },
    licenseType: {
      title: 'License guidance',
      body: 'Select the rights model before upload so publication and downstream usage are unambiguous.',
    },
    licenseConfirmed: {
      title: 'Agreement guidance',
      body: 'Confirm agreement before continuing. Unchecked state blocks progression to upload.',
    },
    rightsConfirmed: {
      title: 'Rights attestation guidance',
      body:
        'Confirm this submission is your own work or work you are authorized to represent, and is not a repost of third-party public-domain material.',
    },
    signatureName: {
      title: 'Digital signature guidance',
      body: 'Type your full name as a digital signature to confirm this legal acknowledgment.',
    },
    link: {
      title: 'Source link guidance',
      body:
        'Provide a stable public URL for source media. Access issues delay review and can move the submission to revision requested.',
    },
    services: {
      title: 'Dex services guidance',
      body:
        'Each service chip includes scope details on hover/focus. Locked defaults are always applied for standard ingest.',
    },
    notes: {
      title: 'Notes guidance',
      body:
        'Use notes for constraints, edit priorities, and context staff should see during review and timeline updates.',
    },
  };

  function createInitialMeta() {
    return {
      title: '',
      creator: '',
      category: '',
      instrument: '',
      bpm: '',
      pitchSystem: '12-tet',
      pitchDescriptor: '',
      keyCenter: '',
      scaleQuality: '',
      tags: '',
      collectionType: '',
      outputTypes: [],
      services: ['chop', 'credits', 'render'],
      notes: '',
      link: '',
    };
  }

  function createInitialCallMeta() {
    return {
      title: '',
      creator: '',
      link: '',
      notes: '',
      callLane: '',
      callSubcall: '',
      callCycle: '',
      proposalFormat: '',
      runtimeMinutes: '',
      availabilityWindow: '',
      portfolioUrl: '',
    };
  }

  function cloneMeta(meta) {
    if (!meta || typeof meta !== 'object') return {};
    return { ...meta };
  }

  function normalizeFlow(value) {
    const flow = text(value, '').toLowerCase();
    return flow === FLOW_CALL ? FLOW_CALL : FLOW_SAMPLE;
  }

  function normalizeLane(value) {
    const lane = text(value, '').toLowerCase();
    return LANE_IDS.has(lane) ? lane : '';
  }

  function normalizeSubcall(value) {
    const subcall = text(value, '').toLowerCase();
    return SUBCALL_IDS.has(subcall) ? subcall : '';
  }

  function deriveLaneFromCycle(value) {
    const cycle = text(value, '').toLowerCase();
    if (!cycle) return '';
    if (cycle.includes('mini-dex') || cycle.includes('minidex')) return 'mini-dex';
    const match = cycle.match(/in dex\\s*([abc])/i) || cycle.match(/^([abc])\\d{4}\\./i);
    if (match?.[1]) return normalizeLane(`in-dex-${String(match[1]).toLowerCase()}`);
    return '';
  }

  function normalizeCallRegistryEntry(entry) {
    if (!entry || typeof entry !== 'object') return null;
    const lane = normalizeLane(entry.lane) || deriveLaneFromCycle(entry.cycleLabel) || deriveLaneFromCycle(entry.cycleCode);
    const status = text(entry.status, '').toLowerCase();
    if (!lane || (status !== 'active' && status !== 'past' && status !== 'draft')) return null;
    return {
      id: text(entry.id),
      lane,
      status,
      cycle: text(entry.cycleLabel || entry.cycleCode),
      sequence: number(entry.sequence, 0),
    };
  }

  function normalizeActiveCallsFromRegistry(payload) {
    const list = Array.isArray(payload?.calls)
      ? payload.calls.map((item) => normalizeCallRegistryEntry(item)).filter(Boolean)
      : [];
    const active = list.filter((item) => item.status === 'active');
    const activeId = text(payload?.activeCallId, '');
    if (activeId) {
      const picked = active.find((item) => item.id === activeId);
      if (picked) return [picked];
    }
    if (active.length <= 1) return active;
    return [...active].sort((left, right) => right.sequence - left.sequence).slice(0, 1);
  }

  function buildRouteFlowHref({ flow, lane = '', subcall = '', cycle = '', via = '' }) {
    const params = new URLSearchParams();
    params.set('flow', normalizeFlow(flow));
    const safeLane = normalizeLane(lane);
    const safeSubcall = normalizeSubcall(subcall);
    if (safeLane) params.set('lane', safeLane);
    if (safeSubcall && safeLane === 'in-dex-a') params.set('subcall', safeSubcall);
    if (text(cycle)) params.set('cycle', text(cycle));
    if (text(via)) params.set('via', text(via));
    return `/entry/submit/?${params.toString()}`;
  }

  function replaceRouteFlowQuery(input = {}) {
    try {
      const next = buildRouteFlowHref({
        flow: input.flow,
        lane: input.lane,
        subcall: input.subcall,
        cycle: input.cycle,
        via: input.via,
      });
      window.history.replaceState({}, '', next);
    } catch {}
  }

  function parseRouteFlowState() {
    try {
      const url = new URL(String(window.location.href || ''), window.location.origin);
      const flow = normalizeFlow(url.searchParams.get('flow'));
      return {
        flow,
        explicitFlow: url.searchParams.has('flow'),
        lane: normalizeLane(url.searchParams.get('lane')),
        subcall: normalizeSubcall(url.searchParams.get('subcall')),
        cycle: text(url.searchParams.get('cycle')),
        via: text(url.searchParams.get('via')),
      };
    } catch {
      return { flow: FLOW_SAMPLE, explicitFlow: false, lane: '', subcall: '', cycle: '', via: '' };
    }
  }

  function baseFlowDraft(flowKey) {
    if (flowKey === FLOW_CALL) {
      return {
        meta: createInitialCallMeta(),
        licenseType: 'joint',
        licenseConfirmed: false,
        rightsConfirmed: false,
        signatureName: '',
      };
    }
    return {
      meta: createInitialMeta(),
      licenseType: 'joint',
      licenseConfirmed: false,
      rightsConfirmed: false,
      signatureName: '',
    };
  }

  // --- Draft persistence (localStorage; survives refresh) ---
  const DRAFT_STORAGE_PREFIX = 'dex:submit:draft:v1';
  const DRAFT_FORM_STEP_MAX = STEPS.length - 2; // steps 0..3 are the form; last is "done"
  let draftSaveTimer = 0;

  function draftStorageKey(sub, flowKey) {
    const safeSub = text(sub, '') || 'anon';
    return `${DRAFT_STORAGE_PREFIX}:${safeSub}:${normalizeFlow(flowKey)}`;
  }

  function readStoredDraft(sub, flowKey) {
    try {
      const raw = window.localStorage.getItem(draftStorageKey(sub, flowKey));
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== 'object' || !parsed.meta || typeof parsed.meta !== 'object') return null;
      return parsed;
    } catch {
      return null;
    }
  }

  function writeStoredDraft(sub, flowKey, draft, step) {
    try {
      const safeStep = Number.isFinite(step) ? Math.max(0, Math.min(DRAFT_FORM_STEP_MAX, step)) : 0;
      window.localStorage.setItem(draftStorageKey(sub, flowKey), JSON.stringify({
        meta: draft.meta,
        licenseType: text(draft.licenseType, 'joint'),
        licenseConfirmed: !!draft.licenseConfirmed,
        rightsConfirmed: !!draft.rightsConfirmed,
        signatureName: text(draft.signatureName, ''),
        step: safeStep,
        savedAt: Date.now(),
      }));
    } catch {}
  }

  function clearStoredDraft(sub, flowKey) {
    try {
      window.localStorage.removeItem(draftStorageKey(sub, flowKey));
    } catch {}
  }

  function clearActiveStoredDrafts() {
    if (!state) return;
    const safeFlow = normalizeFlow(state.flow);
    clearStoredDraft(state.auth0Sub, safeFlow);
    clearStoredDraft('', safeFlow);
  }

  function scheduleDraftSave() {
    if (!state || draftSaveTimer) return;
    draftSaveTimer = window.setTimeout(() => {
      draftSaveTimer = 0;
      if (!state) return;
      const safeFlow = normalizeFlow(state.flow);
      // Never persist the terminal "done" screen; clear so a refresh starts fresh.
      if (state.step >= STEPS.length - 1) {
        clearStoredDraft(state.auth0Sub, safeFlow);
        return;
      }
      writeStoredDraft(state.auth0Sub, safeFlow, getFlowDraft(safeFlow), state.step);
    }, 400);
  }

  function applyStoredDraftToFlow(flowKey, stored) {
    if (!state || !stored || typeof stored !== 'object') return;
    const safeFlow = normalizeFlow(flowKey);
    const base = baseFlowDraft(safeFlow);
    const draft = getFlowDraft(safeFlow);
    draft.meta = cloneMeta({ ...base.meta, ...(stored.meta && typeof stored.meta === 'object' ? stored.meta : {}) });
    draft.licenseType = text(stored.licenseType, 'joint');
    draft.licenseConfirmed = !!stored.licenseConfirmed;
    draft.rightsConfirmed = !!stored.rightsConfirmed;
    draft.signatureName = text(stored.signatureName, '');
  }

  function syncLiveFromActiveDraft(restoredStep) {
    const safeFlow = normalizeFlow(state.flow);
    const draft = getFlowDraft(safeFlow);
    state.meta = cloneMeta(draft.meta);
    state.licenseType = text(draft.licenseType, 'joint');
    state.licenseConfirmed = !!draft.licenseConfirmed;
    state.rightsConfirmed = !!draft.rightsConfirmed;
    state.signatureName = text(draft.signatureName, '');
    if (Number.isFinite(restoredStep)) {
      state.step = Math.max(0, Math.min(DRAFT_FORM_STEP_MAX, restoredStep));
    }
  }

  function hydrateStoredDrafts(sub) {
    if (!state || state.routeFlowExplicit) return false;
    let restoredActive = false;
    let restoredStep = null;
    for (const flowKey of [FLOW_SAMPLE, FLOW_CALL]) {
      const stored = readStoredDraft(sub, flowKey);
      if (!stored) continue;
      applyStoredDraftToFlow(flowKey, stored);
      if (normalizeFlow(flowKey) === normalizeFlow(state.flow)) {
        restoredActive = true;
        restoredStep = Number.isFinite(stored.step) ? stored.step : 0;
      }
    }
    if (restoredActive) syncLiveFromActiveDraft(restoredStep);
    return restoredActive;
  }

  function activeDraftIsPristine() {
    if (!state) return true;
    const base = baseFlowDraft(normalizeFlow(state.flow));
    return state.step === 0
      && !text(state.signatureName, '')
      && !state.licenseConfirmed
      && !state.rightsConfirmed
      && JSON.stringify(cloneMeta(state.meta)) === JSON.stringify(cloneMeta(base.meta));
  }

  function reconcileDraftsForSub(sub) {
    const safeSub = text(sub, '');
    if (!safeSub || !state || state.routeFlowExplicit) return;
    // Migrate anon drafts onto the resolved sub, then (only when the user has
    // not started editing) hydrate the live form from the sub's drafts.
    for (const flowKey of [FLOW_SAMPLE, FLOW_CALL]) {
      if (readStoredDraft(safeSub, flowKey)) continue;
      const anon = readStoredDraft('', flowKey);
      if (anon) {
        writeStoredDraft(safeSub, flowKey, anon, anon.step);
        clearStoredDraft('', flowKey);
      }
    }
    if (activeDraftIsPristine() && hydrateStoredDrafts(safeSub)) {
      render();
    }
  }

  function getCallLaneSchema(laneId) {
    const safeLane = normalizeLane(laneId);
    const lanes = Array.isArray(state?.callSchema?.lanes) ? state.callSchema.lanes : DEFAULT_CALL_SCHEMA.lanes;
    return lanes.find((entry) => normalizeLane(entry?.id) === safeLane) || null;
  }

  function getFlowText() {
    return state?.flow === FLOW_CALL ? 'call' : 'sample';
  }

  function makeState(config) {
    const routeFlow = parseRouteFlowState();
    const sampleDraft = baseFlowDraft(FLOW_SAMPLE);
    const callDraft = baseFlowDraft(FLOW_CALL);
    if (routeFlow.lane) callDraft.meta.callLane = routeFlow.lane;
    if (routeFlow.subcall) callDraft.meta.callSubcall = routeFlow.subcall;
    if (routeFlow.cycle) callDraft.meta.callCycle = routeFlow.cycle;
    const startingFlow = routeFlow.flow === FLOW_CALL ? FLOW_CALL : FLOW_SAMPLE;
    const activeDraft = startingFlow === FLOW_CALL ? callDraft : sampleDraft;
    return {
      step: 0,
      prevProgress: 1 / STEPS.length,
      weeklyLimit: config.weeklyLimit,
      weeklyUsed: 0,
      quotaLeft: 0,
      quotaResolved: false,
      apiBase: config.apiBase,
      auth0Sub: '',
      authUser: null,
      profileDefaults: null,
      profileDefaultsLoaded: false,
      profileDefaultsAutoApplied: false,
      flow: startingFlow,
      // Explicit deep links (?flow=…) skip the lane gate; a plain visit shows the
      // lane chooser once we know active calls exist (see applyCallsRegistryContract).
      pipelineChosen: !!routeFlow.explicitFlow,
      routeFlowExplicit: !!routeFlow.explicitFlow,
      ui: { advancedOpen: false },
      routeFlowRequested: {
        flow: routeFlow.flow,
        lane: routeFlow.lane,
        subcall: routeFlow.subcall,
        cycle: routeFlow.cycle,
      },
      flowDrafts: {
        [FLOW_SAMPLE]: sampleDraft,
        [FLOW_CALL]: callDraft,
      },
      callSchema: DEFAULT_CALL_SCHEMA,
      callsRegistryLoaded: false,
      hasActiveCall: false,
      activeCallCount: 0,
      activeCallLanes: [],
      activeCallCycleByLane: {},
      callLaneLocked: false,
      hasShownInactiveRouteToast: false,
      via: routeFlow.via,
      meta: cloneMeta(activeDraft.meta),
      licenseType: activeDraft.licenseType,
      licenseConfirmed: activeDraft.licenseConfirmed,
      rightsConfirmed: activeDraft.rightsConfirmed,
      signatureName: activeDraft.signatureName,
      lastSubmissionRow: '000',
      lastSubmissionLookup: '',
      lastSubmissionId: '',
      focusedField: '',
      fieldErrors: {},
      validationSummary: '',
      submitting: false,
      submitTicket: 0,
      submitError: '',
    };
  }

  function getFlowDraft(flowKey = DEFAULT_FLOW) {
    if (!state || !state.flowDrafts || typeof state.flowDrafts !== 'object') {
      return baseFlowDraft(flowKey);
    }
    const safeFlow = normalizeFlow(flowKey);
    const draft = state.flowDrafts[safeFlow];
    if (!draft || typeof draft !== 'object') {
      const fallback = baseFlowDraft(safeFlow);
      state.flowDrafts[safeFlow] = fallback;
      return fallback;
    }
    return draft;
  }

  function persistActiveFlowDraft() {
    if (!state) return;
    const safeFlow = normalizeFlow(state.flow);
    const draft = getFlowDraft(safeFlow);
    draft.meta = cloneMeta(state.meta);
    draft.licenseType = text(state.licenseType, 'joint');
    draft.licenseConfirmed = !!state.licenseConfirmed;
    draft.rightsConfirmed = !!state.rightsConfirmed;
    draft.signatureName = text(state.signatureName, '');
    scheduleDraftSave();
  }

  function applyFlowDraft(flowKey) {
    if (!state) return;
    const safeFlow = normalizeFlow(flowKey);
    const draft = getFlowDraft(safeFlow);
    state.flow = safeFlow;
    state.meta = cloneMeta(draft.meta);
    state.licenseType = text(draft.licenseType, 'joint');
    state.licenseConfirmed = !!draft.licenseConfirmed;
    state.rightsConfirmed = !!draft.rightsConfirmed;
    state.signatureName = text(draft.signatureName, '');
    state.submitError = '';
    state.focusedField = '';
    state.fieldErrors = {};
    if (state.step > DRAFT_FORM_STEP_MAX) state.step = 0;
    if (safeFlow === FLOW_CALL) {
      state.meta.callLane = normalizeLane(state.meta.callLane);
      state.meta.callSubcall = normalizeSubcall(state.meta.callSubcall);
    }
  }

  function setActiveFlow(flowKey, options = {}) {
    if (!state) return;
    const safeFlow = normalizeFlow(flowKey);
    const opts = options && typeof options === 'object' ? options : {};
    if (state.flow === safeFlow && !opts.force) return;
    persistActiveFlowDraft();
    applyFlowDraft(safeFlow);
    if (opts.resetStep !== false) state.step = 0;
    state.lastSubmissionRow = '000';
    state.lastSubmissionLookup = '';
    state.quotaResolved = false;
    state.weeklyUsed = 0;
    state.quotaLeft = 0;
    setQuotaSource('none');
    if (opts.refreshQuota !== false) {
      hydrateAuthAndQuota({ forceLive: true }).catch(() => {});
    }
    render();
  }

  async function loadCallSchema() {
    try {
      const response = await fetch(CALL_SCHEMA_URL, { method: 'GET' });
      if (!response.ok) return;
      const payload = await response.json();
      if (!payload || typeof payload !== 'object' || !Array.isArray(payload.lanes)) return;
      state.callSchema = {
        ...DEFAULT_CALL_SCHEMA,
        ...payload,
        lanes: payload.lanes,
      };
      if (state.__callsRegistryPayload) {
        applyCallsRegistryContract(state.__callsRegistryPayload, { announce: false, updateUrl: false });
      }
      if (state.flow === FLOW_CALL && state.step === STEP_COMPOSE) render();
    } catch {}
  }

  function getAvailableCallLanes() {
    const lanes = Array.isArray(state?.callSchema?.lanes) ? state.callSchema.lanes : DEFAULT_CALL_SCHEMA.lanes;
    if (!state?.hasActiveCall) return [];
    const activeSet = new Set(Array.isArray(state.activeCallLanes) ? state.activeCallLanes.map((lane) => normalizeLane(lane)).filter(Boolean) : []);
    return lanes.filter((lane) => activeSet.has(normalizeLane(lane?.id)));
  }

  function applyCallsRegistryContract(payload, options = {}) {
    if (!state) return;
    const opts = options && typeof options === 'object' ? options : {};
    const activeCalls = normalizeActiveCallsFromRegistry(payload);
    const cycleByLane = {};
    const laneOrder = [];
    activeCalls.forEach((entry) => {
      const lane = normalizeLane(entry.lane);
      if (!lane) return;
      if (!laneOrder.includes(lane)) laneOrder.push(lane);
      cycleByLane[lane] = text(entry.cycle);
    });

    state.__callsRegistryPayload = payload;
    state.callsRegistryLoaded = true;
    state.activeCallCount = activeCalls.length;
    state.hasActiveCall = activeCalls.length > 0;
    state.activeCallLanes = laneOrder;
    state.activeCallCycleByLane = cycleByLane;
    state.callLaneLocked = laneOrder.length === 1;

    if (!state.hasActiveCall) {
      state.meta.callLane = '';
      state.meta.callSubcall = '';
      state.meta.callCycle = '';
      state.callLaneLocked = false;

      if (!state.routeFlowExplicit) {
        state.pipelineChosen = true;
        if (state.flow !== FLOW_SAMPLE) applyFlowDraft(FLOW_SAMPLE);
      } else if (state.flow === FLOW_CALL) {
        if (!state.hasShownInactiveRouteToast && opts.announce !== false) {
          showToast('No active IN DEX call right now. Starting sample pipeline.', true);
          state.hasShownInactiveRouteToast = true;
        }
        state.pipelineChosen = true;
        applyFlowDraft(FLOW_SAMPLE);
        if (opts.updateUrl !== false) {
          replaceRouteFlowQuery({
            flow: FLOW_SAMPLE,
            via: text(state.via),
          });
        }
      }
      return;
    }

    const activeSet = new Set(laneOrder);
    const fallbackLane = laneOrder[0] || '';
    if (state.flow === FLOW_CALL) {
      let nextLane = normalizeLane(state.meta.callLane);
      if (state.callLaneLocked && fallbackLane) {
        nextLane = fallbackLane;
      } else if (!nextLane || !activeSet.has(nextLane)) {
        nextLane = fallbackLane;
      }

      const laneChanged = normalizeLane(state.meta.callLane) !== nextLane;
      state.meta.callLane = nextLane;
      if (nextLane !== 'in-dex-a') state.meta.callSubcall = '';
      if (cycleByLane[nextLane]) {
        state.meta.callCycle = cycleByLane[nextLane];
      }

      if (laneChanged && state.routeFlowExplicit && opts.announce !== false && !state.hasShownInactiveRouteToast) {
        showToast('Requested call lane is not active. Switched to the current active lane.', true);
        state.hasShownInactiveRouteToast = true;
      }

      if (opts.updateUrl !== false && nextLane) {
        replaceRouteFlowQuery({
          flow: FLOW_CALL,
          lane: nextLane,
          subcall: nextLane === 'in-dex-a' ? normalizeSubcall(state.meta.callSubcall) : '',
          cycle: text(state.meta.callCycle),
          via: text(state.via, 'call'),
        });
      }
    }
  }

  async function loadCallsRegistry() {
    try {
      const response = await fetch(CALLS_REGISTRY_URL, { method: 'GET' });
      if (!response.ok) {
        state.callsRegistryLoaded = true;
        state.hasActiveCall = false;
        state.activeCallCount = 0;
        return;
      }
      const payload = await response.json();
      applyCallsRegistryContract(payload, { announce: true, updateUrl: true });
      // Re-render when the lane gate should now appear (active calls just loaded
      // and the user hasn't chosen yet) or when on the call compose step.
      if (!state.pipelineChosen || (state.flow === FLOW_CALL && state.step === STEP_COMPOSE)) render();
    } catch {
      state.callsRegistryLoaded = true;
      state.hasActiveCall = false;
      state.activeCallCount = 0;
    }
  }

  function flowDisplayLabel(flowKey) {
    const safeFlow = normalizeFlow(flowKey);
    return safeFlow === FLOW_CALL ? 'Call submission' : 'Sample submission';
  }

  function activeQuotaAction() {
    return state?.flow === FLOW_CALL ? 'quota_call' : 'quota';
  }

  function activeSubmitAction() {
    return state?.flow === FLOW_CALL ? 'submit_call' : 'submit';
  }

  let state = null;
  let liveRoot = null;
  let activeSubmitTooltipTarget = null;
  let lastQuotaFetchError = '';

  function text(value, fallback = '') {
    const normalized = String(value ?? '').trim();
    return normalized || fallback;
  }

  function number(value, fallback = 0) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  }

  function normalizePitchSystem(value) {
    const normalized = text(value).toLowerCase();
    if (normalized === '24-tet') return '24-tet';
    if (normalized === 'ji') return 'ji';
    if (normalized === 'atonal') return 'atonal';
    if (normalized === 'non-pitched') return 'non-pitched';
    return '12-tet';
  }

  function serializePitchSelection(pitchSystem, pitchDescriptor) {
    const system = normalizePitchSystem(pitchSystem);
    const descriptor = text(pitchDescriptor);

    if (system === 'atonal') return 'Atonal';
    if (system === 'non-pitched') return 'Non-pitched';
    if (system === '24-tet') return descriptor ? `24-TET: ${descriptor}` : '24-TET';
    if (system === 'ji') return descriptor ? `JI: ${descriptor}` : 'JI';
    if (!descriptor) return '';
    return `12-TET: ${descriptor}`;
  }

  function isPitchRootDropdownSystem(pitchSystem) {
    return pitchSystem === '12-tet' || pitchSystem === '24-tet';
  }

  function getPitchRootOptions(pitchSystem) {
    if (pitchSystem === '24-tet') return KEY_CENTER_24_TET_OPTIONS;
    if (pitchSystem === '12-tet') return KEY_CENTER_OPTIONS;
    return [];
  }

  function normalizePitchDescriptorForSystem(pitchSystem, descriptor) {
    if (!isPitchRootDropdownSystem(pitchSystem)) return descriptor;
    const options = getPitchRootOptions(pitchSystem);
    const normalized = text(descriptor);
    return options.includes(normalized) ? normalized : '';
  }

  function syncLegacyPitchFields(meta) {
    if (!meta || typeof meta !== 'object') return '';
    meta.pitchSystem = normalizePitchSystem(meta.pitchSystem);
    if (meta.pitchSystem === 'atonal' || meta.pitchSystem === 'non-pitched') {
      meta.pitchDescriptor = '';
    }
    meta.keyCenter = serializePitchSelection(meta.pitchSystem, meta.pitchDescriptor);
    return meta.keyCenter;
  }

  function summarizePitch(meta) {
    if (!meta || typeof meta !== 'object') return 'Unspecified';
    const serialized = text(syncLegacyPitchFields(meta));
    return serialized || 'Unspecified';
  }

  function toLookupWord(value, length, fallback) {
    const letters = String(value || '').replace(/[^A-Za-z]/g, '');
    if (!letters) return fallback;
    const normalized = letters.slice(0, Math.max(1, length)).padEnd(length, 'X').slice(0, length);
    return `${normalized.charAt(0).toUpperCase()}${normalized.slice(1).toLowerCase()}`;
  }

  function parseCollectionTypeCode(value) {
    const raw = text(value, '').toUpperCase();
    if (raw === 'AV') return 'AV';
    if (raw === 'A' || raw.includes('AUDIO')) return 'A';
    if (raw === 'V' || raw.includes('VIDEO')) return 'V';
    return 'O';
  }

  function parseInstrumentTypeCode(value) {
    const raw = text(value, '').toUpperCase();
    const first = raw.match(/[A-Z]/)?.[0] || '';
    return ['K', 'B', 'E', 'S', 'W', 'P', 'V', 'X'].includes(first) ? first : 'X';
  }

  function parseSurnameCandidate(value) {
    const raw = text(value, '');
    if (!raw) return '';
    if (raw.includes(',')) return text(raw.split(',')[0], '');
    const parts = raw.split(/\s+/).filter(Boolean);
    return text(parts[parts.length - 1], '');
  }

  function resolveAuthSurname() {
    const preferred = state && state.authUser && typeof state.authUser === 'object'
      ? state.authUser
      : null;
    const user = preferred
      || (window.AUTH0_USER && typeof window.AUTH0_USER === 'object'
        ? window.AUTH0_USER
        : null);
    if (!user) return '';
    const direct = text(user.family_name || user.surname || user.last_name, '');
    if (direct) return direct;
    return parseSurnameCandidate(user.name || user.nickname || user.email || '');
  }

  function authDisplayName() {
    const user = state && state.authUser && typeof state.authUser === 'object'
      ? state.authUser
      : (window.AUTH0_USER && typeof window.AUTH0_USER === 'object' ? window.AUTH0_USER : null);
    if (!user) return '';
    const name = text(user.name, '');
    if (name && !name.includes('@')) return name;
    const composed = `${text(user.given_name, '')} ${text(user.family_name, '')}`.trim();
    return composed;
  }

  // Pre-fill the digital signature from the signed-in name once, when the user
  // has not typed one and the draft has not supplied one.
  function prefillSignatureFromAuth() {
    if (!state || state.signaturePrefilled) return;
    if (text(state.signatureName)) { state.signaturePrefilled = true; return; }
    const name = authDisplayName();
    if (!name) return;
    state.signatureName = name;
    state.signaturePrefilled = true;
    const draft = getFlowDraft(normalizeFlow(state.flow));
    if (draft) draft.signatureName = name;
    if (state.step === STEP_SEND) render();
  }

  function parsePerformerToken() {
    const surname = resolveAuthSurname();
    const letters = String(surname || '').replace(/[^A-Za-z]/g, '');
    if (!letters) return 'Un';
    const token = letters.slice(0, 2).padEnd(2, 'X');
    return `${token.charAt(0).toUpperCase()}${token.slice(1).toLowerCase()}`;
  }

  function extractAuthSubject(candidate) {
    if (!candidate || typeof candidate !== 'object') return '';
    const subject = text(candidate.sub || candidate.user_id || candidate.email, '');
    return subject;
  }

  async function resolveAuthUser(timeoutMs = AUTH_TIMEOUT_MS) {
    if (window.AUTH0_USER && typeof window.AUTH0_USER === 'object') {
      const existingSub = extractAuthSubject(window.AUTH0_USER);
      if (existingSub) {
        window.auth0Sub = existingSub;
        if (state) state.auth0Sub = existingSub;
      }
      if (state) state.authUser = window.AUTH0_USER;
      return window.AUTH0_USER;
    }

    const runtimeCandidates = [
      window.DEX_AUTH,
      window.dexAuth,
      window.auth0,
    ].filter((candidate) => candidate && typeof candidate.getUser === 'function');

    for (const runtime of runtimeCandidates) {
      try {
        const candidate = runtime.getUser();
        const user = candidate && typeof candidate.then === 'function'
          ? await withTimeout(candidate, timeoutMs, null)
          : candidate;
        if (user && typeof user === 'object') {
          window.AUTH0_USER = user;
          const resolvedSub = extractAuthSubject(user);
          if (resolvedSub) {
            window.auth0Sub = resolvedSub;
            if (state) state.auth0Sub = resolvedSub;
          }
          if (state) state.authUser = user;
          return user;
        }
      } catch {}
    }

    return null;
  }

  function normalizeProfileCategoryCode(value) {
    const normalized = text(value).toUpperCase();
    return ['V', 'K', 'B', 'E', 'S', 'W', 'P', 'X'].includes(normalized) ? normalized : '';
  }

  function resolveSubmitCategoryValue(categoryCode, instrumentHint = '') {
    const code = normalizeProfileCategoryCode(categoryCode);
    const fromCode = code
      ? CATEGORY_OPTIONS.find((value) => text(value).toUpperCase().startsWith(`${code} -`))
      : '';
    if (fromCode) return fromCode;
    const inferred = inferProfileCategoryFromInstrument(instrumentHint);
    if (!inferred) return '';
    return CATEGORY_OPTIONS.find((value) => text(value).toUpperCase().startsWith(`${inferred} -`)) || '';
  }

  function inferProfileCategoryFromInstrument(value) {
    const normalized = text(value).toLowerCase();
    if (!normalized) return '';
    if (normalized.includes('voice') || normalized.includes('vocal') || normalized.includes('vox') || normalized.includes('choir')) return 'V';
    if (normalized.includes('piano') || normalized.includes('organ') || normalized.includes('key')) return 'K';
    if (normalized.includes('trumpet') || normalized.includes('trombone') || normalized.includes('tuba') || normalized.includes('horn')) return 'B';
    if (normalized.includes('violin') || normalized.includes('viola') || normalized.includes('cello') || normalized.includes('bass') || normalized.includes('guitar') || normalized.includes('harp')) return 'S';
    if (normalized.includes('flute') || normalized.includes('clarinet') || normalized.includes('oboe') || normalized.includes('bassoon') || normalized.includes('sax')) return 'W';
    if (normalized.includes('percussion') || normalized.includes('drum') || normalized.includes('marimba') || normalized.includes('vibraphone')) return 'P';
    if (normalized.includes('electronic') || normalized.includes('synth') || normalized.includes('modular') || normalized.includes('field recording')) return 'E';
    return 'X';
  }

  function normalizeSubmitProfileDefaults(profile) {
    const payload = profile && typeof profile === 'object' ? profile : {};
    const submitDefaults = payload.submit_defaults && typeof payload.submit_defaults === 'object'
      ? payload.submit_defaults
      : {};
    const creator = text(submitDefaults.creator || payload.credit_name || payload.name, '');
    const instrument = text(submitDefaults.instrument || payload.instrument_primary || (Array.isArray(payload.instruments) ? payload.instruments[0] : ''), '');
    const category = normalizeProfileCategoryCode(
      submitDefaults.category || inferProfileCategoryFromInstrument(instrument),
    );

    return { creator, category, instrument };
  }

  function hasSubmitProfileDefaults() {
    const defaults = state?.profileDefaults;
    if (!defaults || typeof defaults !== 'object') return false;
    return Boolean(text(defaults.creator) || text(defaults.category) || text(defaults.instrument));
  }

  function getApiAuthRuntimes() {
    return [window.DEX_AUTH, window.dexAuth, window.auth0].filter(Boolean);
  }

  async function getApiAccessToken() {
    const runtimes = getApiAuthRuntimes();
    for (const runtime of runtimes) {
      if (!runtime || typeof runtime.getAccessToken !== 'function') continue;
      try {
        const maybe = runtime.getAccessToken();
        const token = maybe && typeof maybe.then === 'function' ? await maybe : maybe;
        const normalized = text(token, '');
        if (normalized) return normalized;
      } catch {}
    }
    return '';
  }

  async function fetchSubmitProfileDefaults() {
    if (!state || !text(state.apiBase)) return null;
    const token = await getApiAccessToken();
    const headers = { accept: 'application/json' };
    if (token) headers.authorization = `Bearer ${token}`;
    let response = null;
    try {
      response = await fetch(`${state.apiBase}/me/profile`, {
        method: 'GET',
        headers,
      });
    } catch {
      return null;
    }
    if (!response || !response.ok) return null;
    const payload = await response.json().catch(() => null);
    if (!payload || typeof payload !== 'object') return null;
    return normalizeSubmitProfileDefaults(payload);
  }

  function applySubmitProfileDefaults(options = {}) {
    if (!state || !state.profileDefaults) return false;
    const defaults = state.profileDefaults;
    const force = !!options.force;
    let applied = false;

    if ((force || !text(state.meta.creator)) && text(defaults.creator)) {
      state.meta.creator = defaults.creator;
      applied = true;
    }
    if (force || !text(state.meta.category)) {
      const categoryValue = resolveSubmitCategoryValue(defaults.category, defaults.instrument);
      if (text(categoryValue)) {
        state.meta.category = categoryValue;
        applied = true;
      }
    }
    if ((force || !text(state.meta.instrument)) && text(defaults.instrument)) {
      state.meta.instrument = defaults.instrument;
      applied = true;
    }

    if (applied && options.announce !== false) {
      showToast('Profile defaults applied.');
    }
    return applied;
  }

  async function hydrateSubmitProfileDefaults(options = {}) {
    if (!state) return null;
    const force = !!options.force;
    if (state.profileDefaultsLoaded && !force) return state.profileDefaults;
    const defaults = await fetchSubmitProfileDefaults();
    state.profileDefaultsLoaded = true;
    if (defaults) state.profileDefaults = defaults;
    if (!state.profileDefaults) return null;

    if (!state.profileDefaultsAutoApplied) {
      const applied = applySubmitProfileDefaults({ force: false, announce: false });
      if (applied) state.profileDefaultsAutoApplied = true;
    }
    return state.profileDefaults;
  }

  function formatCounter(value) {
    const parsed = Number.parseInt(String(value || '0'), 10);
    const safe = Number.isFinite(parsed) && parsed > 0 ? parsed : 1;
    return String(safe).padStart(2, '0');
  }

  function buildGeneratedSubmissionLookup(counterValue) {
    const counter = formatCounter(counterValue);
    const instrumentType = parseInstrumentTypeCode(state?.meta?.category);
    const instrumentPrefix = toLookupWord(state?.meta?.instrument, 3, 'Unk');
    const performerToken = parsePerformerToken();
    const collectionType = parseCollectionTypeCode(state?.meta?.collectionType);
    const year = new Date().getFullYear();
    return `SUB${counter}-${instrumentType}.${instrumentPrefix} ${performerToken} ${collectionType}${year}`;
  }

  function resolveLookupFromSubmitResponse(response, rowNumber) {
    const value = response && typeof response === 'object' ? response : {};
    const lookup = text(
      value.effectiveLookupNumber
        || value.effective_lookup_number
        || value.finalLookupNumber
        || value.final_lookup_number
        || value.submissionLookupNumber
        || value.submission_lookup_number
        || value.finalLookupBase
        || value.final_lookup_base
        || value.submissionLookupGenerated
        || value.submission_lookup_generated
        || value.lookup,
      '',
    );
    return lookup || buildGeneratedSubmissionLookup(rowNumber);
  }

  function create(tag, className = '', value = '') {
    const el = document.createElement(tag);
    if (className) el.className = className;
    if (value) el.textContent = value;
    return el;
  }

  function withCanonicalZwnj(value) {
    const input = String(value ?? '');
    if (!input) return '';
    let output = '';
    for (let index = 0; index < input.length; index += 1) {
      const current = input[index];
      const previous = index > 0 ? input[index - 1] : '';
      const isDoubleLetter =
        previous &&
        /[A-Za-z]/.test(previous) &&
        /[A-Za-z]/.test(current) &&
        previous.toLowerCase() === current.toLowerCase();
      if (isDoubleLetter) output += '\u200C';
      output += current;
    }
    return output;
  }

  function createSidebarText(tag, className = '', value = '') {
    return create(tag, className, withCanonicalZwnj(value));
  }

  function setFocusedField(fieldKey = '') {
    const next = text(fieldKey);
    if (!state || state.focusedField === next) return;
    state.focusedField = next;
    refreshCommandPanel();
  }

  function bindFieldFocus(control, fieldKey) {
    if (!(control instanceof HTMLElement)) return;
    control.setAttribute('data-dx-focus-key', fieldKey);
    control.addEventListener('focus', () => {
      setFocusedField(fieldKey);
    });
    control.addEventListener('blur', () => {
      window.requestAnimationFrame(() => {
        const active = document.activeElement;
        if (!(active instanceof HTMLElement)) {
          setFocusedField('');
          return;
        }
        if (!liveRoot?.contains(active)) {
          setFocusedField('');
          return;
        }
        if (!active.closest('[data-dx-focus-key]')) {
          setFocusedField('');
        }
      });
    });
  }

  function isReducedMotion() {
    try {
      return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    } catch {
      return false;
    }
  }

  function toConfig(root) {
    const runtime =
      typeof window.__DX_SUBMIT_SAMPLES_CONFIG === 'object' && window.__DX_SUBMIT_SAMPLES_CONFIG
        ? window.__DX_SUBMIT_SAMPLES_CONFIG
        : {};

    const weeklyLimitRaw = runtime.weeklyLimit ?? runtime.dailyLimit ?? root?.dataset?.weeklyLimit ?? root?.dataset?.dailyLimit ?? DEFAULT_WEEKLY_LIMIT;
    const weeklyLimit = Math.max(1, Math.min(99, Math.floor(number(weeklyLimitRaw, DEFAULT_WEEKLY_LIMIT))));
    const apiBase = text(runtime.apiBase || root?.dataset?.api || window.DEX_API_BASE_URL || window.DEX_API_ORIGIN || DEFAULT_API, DEFAULT_API).replace(/\/+$/, '');
    return { weeklyLimit, apiBase };
  }

  function setFetchState(root, fetchState) {
    root.setAttribute('data-dx-fetch-state', fetchState);
    if (fetchState === FETCH_STATE_LOADING) {
      root.setAttribute('aria-busy', 'true');
    } else {
      root.removeAttribute('aria-busy');
    }
  }

  function delay(ms) {
    return new Promise((resolve) => window.setTimeout(resolve, Math.max(0, ms)));
  }

  function withTimeout(promiseLike, timeoutMs, fallback = null) {
    let timer = 0;
    const timeout = new Promise((resolve) => {
      timer = window.setTimeout(() => resolve(fallback), Math.max(1, Number(timeoutMs) || 1));
    });
    return Promise.race([
      Promise.resolve(typeof promiseLike === 'function' ? promiseLike() : promiseLike).catch(() => fallback),
      timeout,
    ]).finally(() => {
      if (timer) window.clearTimeout(timer);
    });
  }

  function canUsePointerHoverTooltip() {
    try {
      return window.matchMedia('(hover: hover) and (pointer: fine)').matches;
    } catch {
      return true;
    }
  }

  function ensureSubmitTooltipLayer() {
    let layer = document.getElementById('dx-submit-tooltip-layer');
    if (layer instanceof HTMLElement) return layer;
    layer = document.createElement('div');
    layer.id = 'dx-submit-tooltip-layer';
    layer.setAttribute('role', 'tooltip');
    layer.setAttribute('aria-hidden', 'true');
    layer.hidden = true;
    document.body.appendChild(layer);
    return layer;
  }

  function hideSubmitTooltip() {
    activeSubmitTooltipTarget = null;
    const layer = document.getElementById('dx-submit-tooltip-layer');
    if (!(layer instanceof HTMLElement)) return;
    layer.hidden = true;
    layer.textContent = '';
    layer.setAttribute('aria-hidden', 'true');
  }

  function positionSubmitTooltip(layer, target) {
    if (!(layer instanceof HTMLElement) || !(target instanceof HTMLElement)) return;
    const viewportPadding = 8;
    layer.style.left = '0px';
    layer.style.top = '0px';
    layer.style.maxWidth = `${Math.max(160, Math.min(280, window.innerWidth - viewportPadding * 2))}px`;

    const targetRect = target.getBoundingClientRect();
    const tooltipRect = layer.getBoundingClientRect();

    let left = targetRect.right - tooltipRect.width;
    left = Math.max(viewportPadding, Math.min(left, window.innerWidth - tooltipRect.width - viewportPadding));

    let top = targetRect.bottom + 8;
    if (top + tooltipRect.height > window.innerHeight - viewportPadding) {
      top = targetRect.top - tooltipRect.height - 8;
    }
    top = Math.max(viewportPadding, top);

    layer.style.left = `${Math.round(left)}px`;
    layer.style.top = `${Math.round(top)}px`;
  }

  function showSubmitTooltip(target) {
    if (!(target instanceof HTMLElement)) return;
    const tooltip = text(target.getAttribute('data-dx-tooltip'));
    if (!tooltip) {
      hideSubmitTooltip();
      return;
    }
    const layer = ensureSubmitTooltipLayer();
    layer.textContent = tooltip;
    layer.hidden = false;
    layer.setAttribute('aria-hidden', 'false');
    positionSubmitTooltip(layer, target);
    activeSubmitTooltipTarget = target;
  }

  function resolveTooltipTarget(input) {
    if (!(input instanceof Element)) return null;
    const target = input.closest('[data-dx-tooltip]');
    if (!(target instanceof HTMLElement)) return null;
    if (!(liveRoot instanceof HTMLElement) || !liveRoot.contains(target)) return null;
    return target;
  }

  function bindSubmitTooltips(scope) {
    if (!(scope instanceof HTMLElement)) return;

    if (scope.__dxSubmitTooltipAbortController instanceof AbortController) {
      try {
        scope.__dxSubmitTooltipAbortController.abort();
      } catch {}
    }

    const controller = new AbortController();
    scope.__dxSubmitTooltipAbortController = controller;
    const options = { signal: controller.signal };
    const hoverEnabled = canUsePointerHoverTooltip();

    scope.querySelectorAll('[data-dx-tooltip]').forEach((node) => {
      if (node instanceof HTMLElement) {
        node.removeAttribute('title');
      }
    });

    if (hoverEnabled) {
      scope.addEventListener('pointerover', (event) => {
        const target = resolveTooltipTarget(event.target);
        if (!target) return;
        if (activeSubmitTooltipTarget === target) return;
        showSubmitTooltip(target);
      }, options);

      scope.addEventListener('pointerout', (event) => {
        if (!(activeSubmitTooltipTarget instanceof HTMLElement)) return;
        const next = resolveTooltipTarget(event.relatedTarget);
        if (next === activeSubmitTooltipTarget) return;
        if (next) {
          showSubmitTooltip(next);
          return;
        }
        hideSubmitTooltip();
      }, options);
    }

    scope.addEventListener('focusin', (event) => {
      const target = resolveTooltipTarget(event.target);
      if (!target) return;
      showSubmitTooltip(target);
    }, options);

    scope.addEventListener('focusout', (event) => {
      const next = resolveTooltipTarget(event.relatedTarget);
      if (next) {
        showSubmitTooltip(next);
        return;
      }
      hideSubmitTooltip();
    }, options);

    window.addEventListener('scroll', () => {
      if (activeSubmitTooltipTarget instanceof HTMLElement) {
        const layer = document.getElementById('dx-submit-tooltip-layer');
        if (layer instanceof HTMLElement && !layer.hidden) {
          positionSubmitTooltip(layer, activeSubmitTooltipTarget);
        }
      }
    }, { signal: controller.signal, passive: true });

    window.addEventListener('resize', () => {
      if (activeSubmitTooltipTarget instanceof HTMLElement) {
        const layer = document.getElementById('dx-submit-tooltip-layer');
        if (layer instanceof HTMLElement && !layer.hidden) {
          positionSubmitTooltip(layer, activeSubmitTooltipTarget);
        }
      }
    }, options);
  }

  async function finalizeFetchState(root, startTs, fetchState = FETCH_STATE_READY) {
    const elapsed = performance.now() - startTs;
    if (elapsed < DX_MIN_SHEEN_MS) {
      await delay(DX_MIN_SHEEN_MS - elapsed);
    }
    setFetchState(root, fetchState);
  }

  function parsePositiveInt(value, fallback = null) {
    const parsed = Number.parseInt(String(value ?? ''), 10);
    if (!Number.isFinite(parsed) || parsed < 0) return fallback;
    return parsed;
  }

  function getPrefetchRuntime() {
    const runtime = window.__DX_PREFETCH;
    if (!runtime || typeof runtime.getFresh !== 'function' || typeof runtime.set !== 'function') return null;
    return runtime;
  }

  function getQuotaPrefetchKey(auth0Sub, flow = DEFAULT_FLOW) {
    const safeSub = text(auth0Sub, '');
    if (!safeSub) return '';
    const safeFlow = normalizeFlow(flow);
    return `quota:${safeFlow}:${safeSub}`;
  }

  function setQuotaSource(source) {
    if (!(liveRoot instanceof HTMLElement)) return;
    liveRoot.setAttribute('data-dx-quota-source', text(source, 'none'));
  }

  function parseQuotaPayload(payload) {
    if (!payload || typeof payload !== 'object') return null;
    const weeklyLimitRaw = parsePositiveInt(payload.weeklyLimit, null);
    const weeklyUsedRaw = parsePositiveInt(payload.weeklyUsed, null);
    const weeklyRemainingRaw = parsePositiveInt(payload.weeklyRemaining, null);
    if (weeklyLimitRaw === null && weeklyUsedRaw === null && weeklyRemainingRaw === null) return null;
    const weeklyLimit = Math.max(1, Math.min(99, weeklyLimitRaw ?? state?.weeklyLimit ?? DEFAULT_WEEKLY_LIMIT));
    const weeklyUsed = Math.max(0, weeklyUsedRaw ?? (weeklyRemainingRaw === null ? 0 : weeklyLimit - weeklyRemainingRaw));
    const weeklyRemaining = Math.max(0, Math.min(weeklyLimit, weeklyRemainingRaw ?? (weeklyLimit - weeklyUsed)));
    return {
      weeklyLimit,
      weeklyUsed,
      weeklyRemaining,
      weekStart: text(payload.weekStart, ''),
      weekEnd: text(payload.weekEnd, ''),
      updatedAt: text(payload.updatedAt, new Date().toISOString()),
    };
  }

  function applyQuotaPayload(quotaPayload) {
    if (!state || !quotaPayload) return false;
    const parsed = parseQuotaPayload(quotaPayload);
    if (!parsed) return false;
    state.weeklyLimit = parsed.weeklyLimit;
    state.weeklyUsed = parsed.weeklyUsed;
    state.quotaLeft = parsed.weeklyRemaining;
    state.quotaResolved = true;
    return true;
  }

  function readCachedQuota(auth0Sub, flow = DEFAULT_FLOW) {
    const prefetch = getPrefetchRuntime();
    const key = getQuotaPrefetchKey(auth0Sub, flow);
    if (!prefetch || !key) return null;
    const cached = prefetch.getFresh(key, PREFETCH_SWR_MS);
    if (!cached || !cached.payload) return null;
    return parseQuotaPayload(cached.payload);
  }

  function writeCachedQuota(auth0Sub, quotaPayload, flow = DEFAULT_FLOW) {
    const prefetch = getPrefetchRuntime();
    const key = getQuotaPrefetchKey(auth0Sub, flow);
    if (!prefetch || !key) return;
    const parsed = parseQuotaPayload(quotaPayload);
    if (!parsed) return;
    prefetch.set(key, parsed, { scope: auth0Sub });
  }

  function quotaSummaryText() {
    if (!state?.quotaResolved) {
      return state?.flow === FLOW_CALL
        ? 'Weekly call submissions available: checking your account quota…'
        : 'Weekly uploads available: checking your account quota…';
    }
    return state?.flow === FLOW_CALL
      ? `Weekly call submissions available: ${state.quotaLeft} / ${state.weeklyLimit}`
      : `Weekly uploads available: ${state.quotaLeft} / ${state.weeklyLimit}`;
  }

  function getQuotaLockReason() {
    if (!state) return '';
    if (!text(state.auth0Sub)) {
      return state.flow === FLOW_CALL
        ? 'Sign in required to verify weekly call submission quota.'
        : 'Sign in required to verify weekly upload quota.';
    }
    if (state.quotaResolved && state.quotaLeft <= 0) {
      return state.flow === FLOW_CALL
        ? `Weekly call submission limit reached (${state.weeklyLimit}/${state.weeklyLimit}).`
        : `Weekly upload limit reached (${state.weeklyLimit}/${state.weeklyLimit}).`;
    }
    return '';
  }

  function isQuotaLocked() {
    return Boolean(getQuotaLockReason());
  }

  function guardQuotaForProgression(showReason = true) {
    const reason = getQuotaLockReason();
    if (!reason) return true;
    if (showReason) showToast(reason, true);
    return false;
  }

  async function fetchWorkerJson(pathname, options = {}) {
    const opts = options && typeof options === 'object' ? options : {};
    if (!state || !text(state.apiBase)) throw new Error('missing Worker API endpoint');
    const token = opts.token || await resolveAccessTokenMaybe(opts.timeoutMs || WORKER_TIMEOUT_MS);
    if (!token) throw new Error('missing auth token');
    const controller = typeof AbortController === 'function' ? new AbortController() : null;
    const timeout = window.setTimeout(() => {
      if (controller) controller.abort();
    }, Math.max(500, Number(opts.timeoutMs || WORKER_TIMEOUT_MS)));
    try {
      const response = await fetch(`${state.apiBase}${pathname}`, {
        method: opts.method || 'GET',
        headers: {
          accept: 'application/json',
          authorization: `Bearer ${token}`,
          ...(opts.body ? { 'content-type': 'application/json' } : {}),
        },
        body: opts.body ? JSON.stringify(opts.body) : undefined,
        signal: controller?.signal,
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        const detail = text(payload?.error || payload?.message || response.statusText, 'request failed');
        throw new Error(detail);
      }
      return payload;
    } finally {
      window.clearTimeout(timeout);
    }
  }

  async function refreshWeeklyQuotaFromSheet(options = {}) {
    const opts = options && typeof options === 'object' ? options : {};
    const forceLive = !!opts.forceLive;
    const useCache = opts.useCache !== false;
    const allowRetry = opts.allowRetry !== false;
    const timeoutMs = Math.max(500, Number(opts.timeoutMs || WORKER_TIMEOUT_MS));
    lastQuotaFetchError = '';
    if (!state || !text(state.apiBase) || !text(state.auth0Sub)) {
      lastQuotaFetchError = 'missing auth identity or submit API endpoint';
      setQuotaSource('none');
      return false;
    }
    const flow = normalizeFlow(state.flow);

    if (useCache && !forceLive) {
      const cached = readCachedQuota(state.auth0Sub, flow);
      if (cached && applyQuotaPayload(cached)) {
        setQuotaSource('cache');
        refreshQuotaCopy();
      }
    }

    const fetchLiveQuota = async () => {
      const flow = normalizeFlow(state.flow);
      const response = await fetchWorkerJson(`/me/submissions/quota?kind=${encodeURIComponent(flow)}`, { timeoutMs });
      const ok = applyQuotaPayload(response);
      if (!ok) {
        lastQuotaFetchError = 'quota response missing expected fields';
        return false;
      }
      writeCachedQuota(state.auth0Sub, response, flow);
      setQuotaSource('live');
      return true;
    };

    try {
      const liveOk = await fetchLiveQuota();
      if (liveOk) return true;
      if (!allowRetry) return false;
      await delay(QUOTA_RETRY_DELAY_MS + Math.floor(Math.random() * 140));
      return await fetchLiveQuota();
    } catch (error) {
      lastQuotaFetchError = text(error?.message, 'quota request failed');
      if (allowRetry) {
        try {
          await delay(QUOTA_RETRY_DELAY_MS + Math.floor(Math.random() * 140));
          return await fetchLiveQuota();
        } catch (retryError) {
          lastQuotaFetchError = text(retryError?.message, lastQuotaFetchError || 'quota retry failed');
        }
      }
      return Boolean(state.quotaResolved && !forceLive);
    }
  }

  function describeQuotaFailure() {
    const detail = text(lastQuotaFetchError, '');
    if (!detail) {
      return state?.flow === FLOW_CALL
        ? 'Could not verify weekly call-submission quota right now. Please retry in a moment.'
        : 'Could not verify weekly quota right now. Please retry in a moment.';
    }
    if (detail.toLowerCase().includes('timeout')) {
      return state?.flow === FLOW_CALL
        ? `Could not verify weekly call-submission quota right now. Timeout after ${SUBMIT_QUOTA_VERIFY_TIMEOUT_MS / 1000}s.`
        : `Could not verify weekly quota right now. Timeout after ${SUBMIT_QUOTA_VERIFY_TIMEOUT_MS / 1000}s.`;
    }
    return state?.flow === FLOW_CALL
      ? `Could not verify weekly call-submission quota right now. Detail: ${detail}.`
      : `Could not verify weekly quota right now. Detail: ${detail}.`;
  }

  function describeSubmitFailure(responsePayload, failureCode = '') {
    if (responsePayload && typeof responsePayload === 'object') {
      const payloadStatus = text(responsePayload.status, '');
      const payloadCode = text(responsePayload.code, '');
      const payloadMessage = text(responsePayload.message, '');
      const weeklyLimit = parsePositiveInt(responsePayload.weeklyLimit, null);
      const weeklyUsed = parsePositiveInt(responsePayload.weeklyUsed, null);
      if (payloadStatus === 'error' && payloadCode === 'weekly_limit_reached') {
        if (weeklyLimit !== null && weeklyUsed !== null) {
          return state?.flow === FLOW_CALL
            ? `Weekly call submission limit reached (${Math.min(weeklyUsed, weeklyLimit)}/${weeklyLimit}).`
            : `Weekly upload limit reached (${Math.min(weeklyUsed, weeklyLimit)}/${weeklyLimit}).`;
        }
        return state?.flow === FLOW_CALL ? 'Weekly call submission limit reached.' : 'Weekly upload limit reached.';
      }
      if (payloadMessage) return `Submission failed: ${payloadMessage}`;
      if (payloadCode) return `Submission failed: ${payloadCode}`;
    }

    if (failureCode === 'submit_timeout') {
      return `Submission request timed out (${SUBMIT_TIMEOUT_MS / 1000}s). No row was written.`;
    }
    if (failureCode === 'script_error') {
      return 'Submission request failed to load the GAS endpoint script.';
    }
    return 'Submission failed before completion. No row was written.';
  }

  function showToast(message, isError = false) {
    if (!(liveRoot instanceof HTMLElement)) return;
    const stack = liveRoot.querySelector('[data-dx-submit-toasts]');
    if (!(stack instanceof HTMLElement)) return;

    const item = create('p', 'dx-submit-toast', message);
    if (isError) item.classList.add('dx-submit-toast--error');
    stack.appendChild(item);

    if (!isReducedMotion()) {
      animate(
        item,
        { opacity: [0, 1], y: [10, 0] },
        { duration: 0.22, ease: 'easeOut' },
      );
    }

    window.setTimeout(() => {
      if (!item.isConnected) return;
      if (isReducedMotion()) {
        item.remove();
        return;
      }
      animate(item, { opacity: [1, 0], y: [0, -8] }, { duration: 0.18, ease: 'easeIn' }).finished.finally(() => {
        item.remove();
      });
    }, 2600);
  }

  async function resolveAccessTokenMaybe(timeoutMs = TOKEN_TIMEOUT_MS) {
    const auth = window.DEX_AUTH || window.dexAuth || null;
    if (!auth || typeof auth.getAccessToken !== 'function') return '';
    try {
      if (typeof auth.resolve === 'function') {
        await withTimeout(() => auth.resolve(Math.min(timeoutMs, 2400)), Math.min(timeoutMs, 2400), null);
      } else if (auth.ready && typeof auth.ready.then === 'function') {
        await withTimeout(auth.ready, Math.min(timeoutMs, 2400), null);
      }
    } catch {}
    const token = await withTimeout(() => auth.getAccessToken(), timeoutMs, '');
    return text(token, '');
  }

  async function refreshAchievementsAfterSubmit() {
    if (!state || !text(state.auth0Sub) || !text(state.apiBase)) return;
    const token = await resolveAccessTokenMaybe(Math.min(ACHIEVEMENTS_REFRESH_TIMEOUT_MS, 2400));
    if (!token) return;

    const controller = typeof AbortController === 'function' ? new AbortController() : null;
    const timeout = window.setTimeout(() => {
      if (controller) controller.abort();
    }, ACHIEVEMENTS_REFRESH_TIMEOUT_MS);

    try {
      const response = await fetch(`${state.apiBase}/me/achievements/summary`, {
        method: 'GET',
        credentials: 'same-origin',
        cache: 'no-store',
        headers: {
          authorization: `Bearer ${token}`,
          'x-dx-request-id': `submit_achv_${Date.now()}`,
        },
        signal: controller ? controller.signal : undefined,
      });
      if (!response.ok) return;
      const payload = await response.json().catch(() => null);
      if (!payload || payload.ok !== true) return;
      const newly = Array.isArray(payload.newlyUnlocked) ? payload.newlyUnlocked : [];
      if (!newly.length) return;
      const firstId = text((newly[0] && newly[0].id) || newly[0], '');
      showToast(newly.length > 1 ? `New achievements unlocked (${newly.length})` : 'New achievement unlocked');
      try {
        if (firstId) {
          window.sessionStorage.setItem('dex:achievements:focus-badge', firstId);
        }
      } catch {}
      try {
        window.dispatchEvent(new CustomEvent('dx:achievements:updated', { detail: payload }));
        for (const item of newly) {
          const badgeId = text((item && item.id) || item, '');
          if (!badgeId) continue;
          window.dispatchEvent(new CustomEvent('dx:achievements:unlocked', { detail: { badgeId } }));
        }
      } catch {}
    } catch {
      // Ignore unlock-check errors; submission already succeeded.
    } finally {
      window.clearTimeout(timeout);
    }
  }

  function laneLabel(laneId) {
    const lane = getCallLaneSchema(laneId);
    if (lane && text(lane.label)) return text(lane.label);
    return text(laneId, 'call lane').toUpperCase();
  }

  function setFieldErrors(errors) {
    state.fieldErrors = errors && typeof errors === 'object' ? errors : {};
  }

  // A validation failure records per-field inline errors (state.fieldErrors)
  // plus a summary string. The caller re-renders (to paint the inline errors),
  // then raises a single summary toast for screen-reader announcement.
  function failValidation(errors, summary) {
    setFieldErrors(errors);
    const keys = Object.keys(errors);
    state.validationSummary = text(summary, '')
      || (keys.length ? text(errors[keys[0]], 'Missing required fields.') : 'Missing required fields.');
    return false;
  }

  function renderMetaValidationFailure() {
    render();
    showToast(text(state.validationSummary, '') || 'Missing required fields.', true);
    const firstInvalid = liveRoot?.querySelector('.dx-submit-field.has-error .dx-submit-input');
    if (firstInvalid instanceof HTMLElement) {
      try { firstInvalid.focus({ preventScroll: false }); } catch {}
    }
  }

  function validateSampleMeta() {
    const errors = {};
    const required = ['title', 'creator', 'instrument', 'category', 'collectionType', 'link'];
    for (const key of required) {
      const value = state.meta[key];
      if (Array.isArray(value) ? value.length === 0 : !text(value)) errors[key] = 'Required';
    }
    if (Object.keys(errors).length) return failValidation(errors, 'Missing required fields.');
    setFieldErrors({});
    return true;
  }

  function validateCallMeta() {
    if (!state.hasActiveCall) {
      return failValidation({}, 'No active call lane is currently open.');
    }
    const errors = {};
    const lane = normalizeLane(state.meta.callLane);
    if (!lane) {
      errors.callLane = 'Choose a call lane.';
    } else if (!Array.isArray(state.activeCallLanes) || !state.activeCallLanes.includes(lane)) {
      errors.callLane = 'Selected call lane is not currently active.';
    }
    if (!text(state.meta.title)) errors.title = 'Required';
    if (!text(state.meta.creator)) errors.creator = 'Required';
    if (!text(state.meta.link)) errors.link = 'Required';

    if (lane && !errors.callLane) {
      const laneSchema = getCallLaneSchema(lane);
      const fields = Array.isArray(laneSchema?.fields) ? laneSchema.fields : [];
      for (const field of fields) {
        if (!field || typeof field !== 'object') continue;
        if (!field.required) continue;
        const fieldKey = text(field.key, '');
        if (!fieldKey) continue;
        const value = state.meta[fieldKey];
        if (!text(value)) {
          errors[fieldKey] = 'Required';
          continue;
        }
        if (text(field.type, '').toLowerCase() === 'number') {
          const parsed = Number(value);
          const min = Number.isFinite(Number(field.min)) ? Number(field.min) : null;
          const max = Number.isFinite(Number(field.max)) ? Number(field.max) : null;
          if (!Number.isFinite(parsed)) errors[fieldKey] = 'Enter a number.';
          else if (min !== null && parsed < min) errors[fieldKey] = `Must be at least ${min}.`;
          else if (max !== null && parsed > max) errors[fieldKey] = `Must be at most ${max}.`;
        }
      }
      if (lane === 'in-dex-a' && !normalizeSubcall(state.meta.callSubcall)) {
        errors.callSubcall = 'Choose an IN DEX A subcall.';
      }
    }

    if (Object.keys(errors).length) {
      const summary = errors.callLane || 'Missing required fields.';
      return failValidation(errors, summary);
    }
    setFieldErrors({});
    return true;
  }

  function validateMeta() {
    return state.flow === FLOW_CALL ? validateCallMeta() : validateSampleMeta();
  }

  function toBadge(label, selected, onClick, disabled = false, options = null) {
    const button = create('button', 'dx-submit-badge', label);
    button.type = 'button';
    if (selected) button.classList.add('is-selected');
    if (disabled) {
      button.classList.add('is-disabled');
      button.disabled = true;
    }
    const badgeOptions = options && typeof options === 'object' ? options : {};
    const tooltip = text(badgeOptions.tooltip);
    if (tooltip) {
      button.setAttribute('data-dx-tooltip', tooltip);
      button.setAttribute('aria-label', `${label}. ${tooltip}`);
      button.removeAttribute('title');
    }
    if (text(badgeOptions.focusKey)) {
      bindFieldFocus(button, text(badgeOptions.focusKey));
    }
    if (typeof onClick === 'function' && !disabled) {
      button.addEventListener('click', onClick);
    }
    return button;
  }

  function wrapField(labelText, required = false, fieldKey = '') {
    const field = create('label', 'dx-submit-field');
    const key = text(fieldKey, '');
    if (key) field.setAttribute('data-dx-field', key);
    const label = create('span', 'dx-submit-field-label', `${labelText}${required ? ' *' : ''}`);
    field.appendChild(label);
    const errMsg = key ? text(state?.fieldErrors?.[key], '') : '';
    if (errMsg) {
      field.classList.add('has-error');
      const err = create('p', 'dx-submit-field-error', errMsg);
      err.setAttribute('role', 'alert');
      field.appendChild(err);
      const clearOnce = () => {
        field.classList.remove('has-error');
        if (err.parentNode) err.remove();
        if (state && state.fieldErrors) delete state.fieldErrors[key];
        field.removeEventListener('input', clearOnce);
        field.removeEventListener('change', clearOnce);
      };
      field.addEventListener('input', clearOnce);
      field.addEventListener('change', clearOnce);
    }
    return field;
  }

  function buildProgressHeader() {
    const wrap = create('div', 'dx-submit-progress-wrap');
    wrap.setAttribute('data-dx-submit-progress', String(state.step));

    const row = create('div', 'dx-submit-progress-row');
    STEPS.forEach((step, index) => {
      const chip = create('button', 'dx-submit-step-chip', `${index + 1}. ${step.short}`);
      chip.type = 'button';
      chip.disabled = index > state.step;
      chip.setAttribute('data-step-key', step.key);
      if (index < state.step) chip.classList.add('is-done');
      if (index === state.step) chip.classList.add('is-active');
      chip.addEventListener('click', () => {
        if (index > state.step) return;
        state.step = index;
        render();
      });
      row.appendChild(chip);
    });

    const bar = create('div', 'dx-submit-progress-bar');
    const fill = create('span', 'dx-submit-progress-fill');
    fill.style.transform = `scaleX(${(state.step + 1) / STEPS.length})`;
    bar.appendChild(fill);

    wrap.append(row, bar);
    return wrap;
  }

  function buildQuotaActionCard() {
    const actionCard = create('article', 'dx-submit-action-card');
    actionCard.appendChild(create('p', 'dx-submit-action-kicker', 'Action required'));
    actionCard.appendChild(
      create(
        'p',
        'dx-submit-action-copy',
        state?.flow === FLOW_CALL
          ? 'Weekly call submission limit reached for this account.'
          : 'Weekly upload limit reached for this account.',
      ),
    );
    return actionCard;
  }

  function updateCallMetaValue(fieldKey, nextValue) {
    if (!state || !state.meta) return;
    state.meta[fieldKey] = nextValue;
    if (fieldKey === 'callLane') {
      const safeLane = normalizeLane(nextValue);
      state.meta.callLane = safeLane;
      const laneSchema = getCallLaneSchema(safeLane);
      const hasSubcall = Array.isArray(laneSchema?.fields)
        && laneSchema.fields.some((entry) => text(entry?.key) === 'callSubcall');
      if (!hasSubcall) state.meta.callSubcall = '';
      if (!safeLane) {
        state.meta.proposalFormat = '';
        state.meta.runtimeMinutes = '';
        state.meta.availabilityWindow = '';
        state.meta.portfolioUrl = '';
      }
      render();
    }
  }

  // Custom accessible single-select dropdown that replaces native <select>.
  // Renders a styled toggle + a dark-glass listbox (keyboard + outside-click
  // aware) so the open menu matches the form chrome instead of the OS popup.
  function createDropdown({ value = '', placeholder = 'Choose…', options = [], onChange, fieldKey = '' } = {}) {
    const normalized = (Array.isArray(options) ? options : [])
      .map((entry) => ({ value: text(entry?.value, ''), label: text(entry?.label, text(entry?.value, '')) }))
      .filter((entry) => entry.value !== '' || entry.label);
    const selectable = normalized.filter((entry) => entry.value !== '');
    let current = text(value, '');
    let open = false;

    const root = create('div', 'dx-submit-dropdown');
    root.setAttribute('data-dx-dropdown', 'true');

    const toggle = create('button', 'dx-submit-input dx-submit-dropdown-toggle');
    toggle.type = 'button';
    toggle.setAttribute('aria-haspopup', 'listbox');
    toggle.setAttribute('aria-expanded', 'false');
    const valueEl = create('span', 'dx-submit-dropdown-value');
    const chevron = create('span', 'dx-submit-dropdown-chevron', '▾');
    chevron.setAttribute('aria-hidden', 'true');
    toggle.append(valueEl, chevron);

    const menu = create('div', 'dx-submit-dropdown-menu');
    menu.setAttribute('role', 'listbox');
    menu.hidden = true;

    const labelFor = (val) => {
      const found = normalized.find((entry) => entry.value === val);
      return found ? found.label : '';
    };
    const syncLabel = () => {
      const label = labelFor(current);
      valueEl.textContent = label || placeholder;
      valueEl.classList.toggle('is-placeholder', !label);
    };
    const onDocPointer = (event) => { if (!root.contains(event.target)) setOpen(false); };
    const onKeydown = (event) => {
      const items = Array.from(menu.querySelectorAll('.dx-submit-dropdown-option'));
      const index = items.indexOf(document.activeElement);
      if (event.key === 'Escape') { event.preventDefault(); setOpen(false); toggle.focus(); }
      else if (event.key === 'ArrowDown') { event.preventDefault(); (items[index + 1] || items[0])?.focus(); }
      else if (event.key === 'ArrowUp') { event.preventDefault(); (items[index - 1] || items[items.length - 1])?.focus(); }
      else if ((event.key === 'Enter' || event.key === ' ') && index >= 0) { event.preventDefault(); pick(items[index].getAttribute('data-value')); }
    };
    function buildMenu() {
      menu.innerHTML = '';
      selectable.forEach((entry) => {
        const option = create('button', 'dx-submit-dropdown-option', entry.label);
        option.type = 'button';
        option.setAttribute('role', 'option');
        option.setAttribute('data-value', entry.value);
        const isSel = entry.value === current;
        option.setAttribute('aria-selected', isSel ? 'true' : 'false');
        if (isSel) option.classList.add('is-selected');
        option.addEventListener('click', () => pick(entry.value));
        menu.appendChild(option);
      });
    }
    function setOpen(next) {
      if (next === open) return;
      open = next;
      menu.hidden = !next;
      toggle.setAttribute('aria-expanded', next ? 'true' : 'false');
      root.classList.toggle('is-open', next);
      if (next) {
        buildMenu();
        document.addEventListener('pointerdown', onDocPointer, true);
        document.addEventListener('keydown', onKeydown, true);
        const sel = menu.querySelector('.is-selected') || menu.querySelector('.dx-submit-dropdown-option');
        if (sel instanceof HTMLElement) sel.focus();
      } else {
        document.removeEventListener('pointerdown', onDocPointer, true);
        document.removeEventListener('keydown', onKeydown, true);
      }
    }
    function pick(val) {
      current = text(val, '');
      syncLabel();
      setOpen(false);
      try { toggle.focus(); } catch {}
      if (typeof onChange === 'function') onChange(current);
    }
    toggle.addEventListener('click', () => setOpen(!open));
    if (fieldKey) bindFieldFocus(toggle, fieldKey);
    syncLabel();
    root.append(toggle, menu);
    return root;
  }

  function buildCallDynamicField(fieldSchema) {
    const schema = fieldSchema && typeof fieldSchema === 'object' ? fieldSchema : {};
    const fieldKey = text(schema.key, '');
    if (!fieldKey) return null;
    const label = text(schema.label, fieldKey);
    const required = !!schema.required;
    const field = wrapField(label, required, fieldKey);
    const type = text(schema.type, 'text').toLowerCase();
    const currentValue = text(state.meta[fieldKey], '');

    if (type === 'select') {
      const dropdown = createDropdown({
        value: currentValue,
        placeholder: `Choose ${label.toLowerCase()}`,
        options: Array.isArray(schema.options) ? schema.options : [],
        fieldKey,
        onChange: (val) => updateCallMetaValue(fieldKey, val),
      });
      field.appendChild(dropdown);
      return field;
    }

    const input = create(type === 'number' ? 'input' : 'input', 'dx-submit-input');
    if (input instanceof HTMLInputElement) {
      input.type = type === 'url' ? 'url' : type === 'number' ? 'number' : 'text';
      if (Number.isFinite(Number(schema.maxLength))) input.maxLength = Math.max(1, Number(schema.maxLength));
      if (type === 'number') {
        if (Number.isFinite(Number(schema.min))) input.min = String(Math.floor(Number(schema.min)));
        if (Number.isFinite(Number(schema.max))) input.max = String(Math.floor(Number(schema.max)));
        input.step = '1';
      }
      input.value = currentValue;
      input.addEventListener('input', (event) => {
        updateCallMetaValue(fieldKey, event.target.value);
      });
      bindFieldFocus(input, fieldKey);
    }
    field.appendChild(input);
    return field;
  }

  // ===== Redesigned compose/send flow =====

  function switchPipeline(flowKey) {
    if (!state) return;
    const target = normalizeFlow(flowKey);
    if (target === normalizeFlow(state.flow)) return;
    if (target === FLOW_CALL && !state.hasActiveCall) {
      showToast('No active IN DEX call right now.', true);
      return;
    }
    state.pipelineChosen = true;
    setActiveFlow(target, { force: true, resetStep: true, refreshQuota: true });
  }

  function buildPipelineSwitch() {
    const wrap = create('div', 'dx-submit-switch');
    wrap.setAttribute('role', 'tablist');
    wrap.setAttribute('aria-label', 'Submission pipeline');
    const make = (flowKey, label, disabled) => {
      const active = normalizeFlow(state.flow) === flowKey;
      const btn = create('button', 'dx-submit-switch-option', label);
      btn.type = 'button';
      btn.setAttribute('role', 'tab');
      btn.setAttribute('aria-selected', active ? 'true' : 'false');
      btn.setAttribute('data-flow', flowKey);
      if (active) btn.classList.add('is-active');
      if (disabled) {
        btn.disabled = true;
        btn.classList.add('is-disabled');
      } else if (!active) {
        btn.addEventListener('click', () => switchPipeline(flowKey));
      }
      return btn;
    };
    wrap.append(
      make(FLOW_SAMPLE, 'Sample', false),
      make(FLOW_CALL, 'IN DEX Call', !state.hasActiveCall),
    );
    return wrap;
  }

  // --- Reusable field builders (write straight to state.meta) ---
  function metaTextField(label, key, placeholder, maxLen, required, type = 'text') {
    const field = wrapField(label, !!required, key);
    const input = create('input', 'dx-submit-input');
    input.type = type;
    if (maxLen) input.maxLength = maxLen;
    input.placeholder = placeholder || '';
    input.value = text(state.meta[key]);
    input.addEventListener('input', (event) => { state.meta[key] = event.target.value; });
    bindFieldFocus(input, key);
    field.appendChild(input);
    return field;
  }

  function metaTextareaField(label, key, placeholder) {
    const field = wrapField(label, false, key);
    const area = create('textarea', 'dx-submit-input dx-submit-notes');
    area.rows = 5;
    area.placeholder = placeholder || '';
    area.value = text(state.meta[key]);
    area.addEventListener('input', (event) => { state.meta[key] = event.target.value; });
    bindFieldFocus(area, key);
    field.appendChild(area);
    return field;
  }

  function metaSelectField(label, key, options, required) {
    const field = wrapField(label, !!required, key);
    const dropdown = createDropdown({
      value: text(state.meta[key]),
      placeholder: options.find((value) => !value) != null ? `Choose ${label.toLowerCase()}` : 'Choose…',
      options: options.map((value) => ({ value, label: value || `Choose ${label.toLowerCase()}` })),
      fieldKey: key,
      onChange: (val) => { state.meta[key] = val; },
    });
    field.appendChild(dropdown);
    return field;
  }

  function collectionTypeField() {
    const field = wrapField('Collection type', true, 'collectionType');
    const group = create('div', 'dx-submit-badge-group');
    COLLECTION_OPTIONS.forEach((entry) => {
      group.appendChild(toBadge(
        entry.label,
        state.meta.collectionType === entry.value,
        () => { state.meta.collectionType = entry.value; render(); },
        false,
        { focusKey: 'collectionType' },
      ));
    });
    field.appendChild(group);
    return field;
  }

  function outputTypesField() {
    const field = wrapField('Release formats', false, 'outputTypes');
    const group = create('div', 'dx-submit-badge-group');
    OUTPUT_OPTIONS.forEach((entry) => {
      const selected = state.meta.outputTypes.includes(entry.value);
      group.appendChild(toBadge(entry.label, selected, () => {
        state.meta.outputTypes = selected
          ? state.meta.outputTypes.filter((value) => value !== entry.value)
          : [...state.meta.outputTypes, entry.value];
        render();
      }, false, { focusKey: 'outputTypes' }));
    });
    field.appendChild(group);
    return field;
  }

  function servicesFieldControl() {
    const field = wrapField('Production services', false, 'services');
    field.appendChild(create('p', 'dx-submit-copy dx-submit-copy--compact', 'Locked services are always applied. Add optional post-production as needed.'));
    const group = create('div', 'dx-submit-badge-group');
    SERVICE_OPTIONS.forEach((entry) => {
      const selected = state.meta.services.includes(entry.value);
      group.appendChild(toBadge(
        entry.locked ? `\u{1F512} ${entry.label}` : entry.label,
        selected,
        () => {
          state.meta.services = selected
            ? state.meta.services.filter((value) => value !== entry.value)
            : [...state.meta.services, entry.value];
          render();
        },
        entry.locked,
        { tooltip: entry.tooltip, focusKey: 'services' },
      ));
    });
    field.appendChild(group);
    return field;
  }

  // --- Strengthened controls ---
  function buildPitchControl() {
    const system = normalizePitchSystem(state.meta.pitchSystem);
    state.meta.pitchSystem = system;
    state.meta.pitchDescriptor = normalizePitchDescriptorForSystem(system, state.meta.pitchDescriptor);
    syncLegacyPitchFields(state.meta);

    const field = wrapField('Tonality', false, 'pitchSystem');
    const seg = create('div', 'dx-submit-seg');
    PITCH_SYSTEM_OPTIONS.forEach((entry) => {
      const btn = create('button', 'dx-submit-seg-option', entry.label);
      btn.type = 'button';
      const active = entry.value === system;
      if (active) btn.classList.add('is-active');
      btn.setAttribute('aria-pressed', active ? 'true' : 'false');
      btn.addEventListener('click', () => {
        state.meta.pitchSystem = normalizePitchSystem(entry.value);
        state.meta.pitchDescriptor = normalizePitchDescriptorForSystem(state.meta.pitchSystem, state.meta.pitchDescriptor);
        if (state.meta.pitchSystem === 'atonal' || state.meta.pitchSystem === 'non-pitched') state.meta.pitchDescriptor = '';
        syncLegacyPitchFields(state.meta);
        render();
      });
      seg.appendChild(btn);
    });
    field.appendChild(seg);

    if (isPitchRootDropdownSystem(system)) {
      field.appendChild(create('p', 'dx-submit-copy dx-submit-copy--compact', 'Root note'));
      const notes = create('div', 'dx-submit-notechips');
      getPitchRootOptions(system).forEach((value) => {
        const chip = create('button', 'dx-submit-notechip', value);
        chip.type = 'button';
        if (text(state.meta.pitchDescriptor) === value) chip.classList.add('is-active');
        chip.addEventListener('click', () => {
          state.meta.pitchDescriptor = text(state.meta.pitchDescriptor) === value ? '' : value;
          syncLegacyPitchFields(state.meta);
          render();
        });
        notes.appendChild(chip);
      });
      field.appendChild(notes);
    } else if (system === 'ji') {
      field.appendChild(create('p', 'dx-submit-copy dx-submit-copy--compact', PITCH_DESCRIPTOR_HINTS.ji));
      const input = create('input', 'dx-submit-input');
      input.type = 'text';
      input.maxLength = 120;
      input.placeholder = 'Ex: 5/4 on C';
      input.value = text(state.meta.pitchDescriptor);
      input.addEventListener('input', (event) => {
        state.meta.pitchDescriptor = event.target.value;
        syncLegacyPitchFields(state.meta);
      });
      bindFieldFocus(input, 'pitchDescriptor');
      field.appendChild(input);
    } else {
      field.appendChild(create('p', 'dx-submit-copy dx-submit-copy--compact', 'No root note needed for this tonality.'));
    }
    return field;
  }

  function buildScaleQualityControl() {
    const field = wrapField('Scale quality', false, 'scaleQuality');
    const input = create('input', 'dx-submit-input');
    input.type = 'text';
    input.maxLength = 50;
    input.placeholder = 'e.g. dorian, maqam, blues…';
    input.setAttribute('list', 'dx-submit-scale-list');
    input.value = text(state.meta.scaleQuality);
    input.addEventListener('input', (event) => { state.meta.scaleQuality = event.target.value; });
    bindFieldFocus(input, 'scaleQuality');
    field.appendChild(input);
    const datalist = create('datalist');
    datalist.id = 'dx-submit-scale-list';
    SCALE_QUALITY_SUGGESTIONS.forEach((value) => {
      const option = create('option');
      option.value = value;
      datalist.appendChild(option);
    });
    field.appendChild(datalist);
    return field;
  }

  function getTagTokens() {
    return text(state.meta.tags).split(',').map((token) => token.trim()).filter(Boolean);
  }

  function setTagTokens(tokens) {
    const seen = new Set();
    const out = [];
    tokens.forEach((token) => {
      const key = token.toLowerCase();
      if (!seen.has(key)) { seen.add(key); out.push(token); }
    });
    state.meta.tags = out.join(', ');
  }

  function buildTagsControl() {
    const field = wrapField('Tags', false, 'tags');
    field.appendChild(create('p', 'dx-submit-copy dx-submit-copy--compact', 'Pick from suggestions or type your own, then press Enter.'));

    const box = create('div', 'dx-submit-tokens');
    const input = create('input', 'dx-submit-tok-input');
    input.type = 'text';
    input.placeholder = 'Add a tag…';
    bindFieldFocus(input, 'tags');

    const suggest = create('div', 'dx-submit-tag-suggest');
    const suggestButtons = [];

    function renderSuggestState() {
      const codes = getTagTokens().map((token) => token.toLowerCase());
      suggestButtons.forEach((btn) => {
        const on = codes.includes(String(btn.dataset.code).toLowerCase());
        btn.classList.toggle('is-selected', on);
        btn.setAttribute('aria-pressed', on ? 'true' : 'false');
      });
    }

    function renderTokens() {
      box.querySelectorAll('.dx-submit-tok').forEach((node) => node.remove());
      getTagTokens().forEach((token) => {
        const chip = create('span', 'dx-submit-tok');
        const labelText = TAG_CODE_TO_LABEL[token.toLowerCase()] || token;
        chip.appendChild(create('span', 'dx-submit-tok-label', labelText));
        const remove = create('button', 'dx-submit-tok-remove', '×');
        remove.type = 'button';
        remove.setAttribute('aria-label', `Remove ${labelText}`);
        remove.addEventListener('click', () => {
          setTagTokens(getTagTokens().filter((value) => value.toLowerCase() !== token.toLowerCase()));
          renderTokens();
          renderSuggestState();
        });
        chip.appendChild(remove);
        box.insertBefore(chip, input);
      });
    }

    input.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' || event.key === ',') {
        event.preventDefault();
        const value = input.value.trim().replace(/,+$/, '').trim();
        if (value) {
          setTagTokens([...getTagTokens(), value]);
          input.value = '';
          renderTokens();
          renderSuggestState();
        }
      } else if (event.key === 'Backspace' && !input.value) {
        const tokens = getTagTokens();
        if (tokens.length) {
          tokens.pop();
          setTagTokens(tokens);
          renderTokens();
          renderSuggestState();
        }
      }
    });

    box.appendChild(input);
    field.appendChild(box);

    TAG_VOCAB.forEach((facet) => {
      const row = create('div', 'dx-submit-tag-facet');
      row.appendChild(create('span', 'dx-submit-tag-facet-label', facet.facet));
      facet.items.forEach((item) => {
        const btn = create('button', 'dx-submit-tag-opt', item.label);
        btn.type = 'button';
        btn.dataset.code = item.code;
        btn.addEventListener('click', () => {
          const tokens = getTagTokens();
          const has = tokens.some((token) => token.toLowerCase() === item.code.toLowerCase());
          setTagTokens(has
            ? tokens.filter((token) => token.toLowerCase() !== item.code.toLowerCase())
            : [...tokens, item.code]);
          renderTokens();
          renderSuggestState();
        });
        suggestButtons.push(btn);
        row.appendChild(btn);
      });
      suggest.appendChild(row);
    });
    field.appendChild(suggest);

    renderTokens();
    renderSuggestState();
    return field;
  }

  // --- Compose bodies ---
  function buildSampleComposeBody() {
    const frag = document.createDocumentFragment();

    const defaultsWrap = create('div', 'dx-submit-stage-actions');
    defaultsWrap.appendChild(create(
      'p',
      'dx-submit-copy dx-submit-copy--compact',
      hasSubmitProfileDefaults()
        ? 'Profile defaults are available for creator / category / instrument.'
        : 'Add defaults in Settings → Contribution Profile to speed up repeat submissions.',
    ));
    const applyBtn = create('button', 'cta-btn dx-button-element dx-button-size--sm dx-button-element--secondary', 'Apply profile defaults');
    applyBtn.type = 'button';
    applyBtn.disabled = !hasSubmitProfileDefaults();
    applyBtn.classList.toggle('is-disabled', !hasSubmitProfileDefaults());
    applyBtn.addEventListener('click', () => { if (applySubmitProfileDefaults({ force: true, announce: true })) render(); });
    defaultsWrap.appendChild(applyBtn);
    frag.appendChild(defaultsWrap);

    const essentials = create('section', 'dx-submit-group');
    essentials.appendChild(create('p', 'dx-submit-group-label', 'Essentials'));
    const grid = create('div', 'dx-submit-grid');
    grid.append(
      metaTextField('Proposed sample title', 'title', 'Ex: Prepared Trombone Long Tones', 100, true),
      metaTextField('Sample creator(s)', 'creator', 'Ex: Jane Doe, John Doe', 2000, true),
      metaSelectField('Instrument category', 'category', CATEGORY_OPTIONS, true),
      metaTextField('Instrument', 'instrument', 'Ex: Prepared Trombone', 120, true),
      collectionTypeField(),
    );
    essentials.appendChild(grid);
    essentials.appendChild(metaTextField('Public source link', 'link', 'https://drive.google.com/...', 0, true, 'url'));
    frag.appendChild(essentials);

    const advanced = create('details', 'dx-submit-advanced');
    advanced.open = !!(state.ui && state.ui.advancedOpen);
    advanced.addEventListener('toggle', () => {
      if (!state.ui) state.ui = {};
      state.ui.advancedOpen = advanced.open;
    });
    advanced.appendChild(create('summary', 'dx-submit-advanced-summary', 'Advanced — tuning, tags & production'));
    const advGrid = create('div', 'dx-submit-grid');
    advGrid.append(
      metaTextField('BPM', 'bpm', '120', 0, false, 'number'),
      buildPitchControl(),
      buildScaleQualityControl(),
    );
    advanced.appendChild(advGrid);
    advanced.appendChild(buildTagsControl());
    advanced.appendChild(outputTypesField());
    advanced.appendChild(servicesFieldControl());
    frag.appendChild(advanced);

    frag.appendChild(metaTextareaField('Notes for Dex team', 'notes', 'Any delivery constraints, context, or edit notes'));
    return frag;
  }

  function buildCallComposeBody() {
    const frag = document.createDocumentFragment();
    const essentials = create('section', 'dx-submit-group');
    essentials.appendChild(create('p', 'dx-submit-group-label', 'Call essentials'));
    const grid = create('div', 'dx-submit-grid');

    const laneField = wrapField('Call lane', true, 'callLane');
    const laneGroup = create('div', 'dx-submit-badge-group');
    const lanes = getAvailableCallLanes();
    lanes.forEach((lane) => {
      const laneId = normalizeLane(lane?.id);
      if (!laneId) return;
      laneGroup.appendChild(toBadge(
        text(lane?.label, laneId),
        laneId === normalizeLane(state.meta.callLane),
        () => updateCallMetaValue('callLane', laneId),
        !!state.callLaneLocked,
        { focusKey: 'callLane' },
      ));
    });
    laneField.appendChild(laneGroup);
    if (!lanes.length) {
      laneField.appendChild(create('p', 'dx-submit-copy dx-submit-copy--compact', 'No active call lanes are available right now.'));
    } else if (state.callLaneLocked && lanes.length === 1) {
      laneField.appendChild(create('p', 'dx-submit-copy dx-submit-copy--compact', `Locked to active lane: ${text(lanes[0]?.label, 'IN DEX')}.`));
    }
    grid.appendChild(laneField);

    grid.append(
      metaTextField('Proposal title', 'title', 'Ex: dexFest panel proposal', 100, true),
      metaTextField('Proposer / creator', 'creator', 'Ex: Jane Doe', 2000, true),
    );

    const cycleField = wrapField('Call cycle', false, 'callCycle');
    const cycleInput = create('input', 'dx-submit-input');
    cycleInput.type = 'text';
    cycleInput.maxLength = 120;
    cycleInput.placeholder = 'Ex: IN DEX A2024.4';
    cycleInput.value = text(state.meta.callCycle);
    if (state.callLaneLocked && !!text(state.meta.callCycle)) {
      cycleInput.readOnly = true;
      cycleInput.disabled = true;
      cycleInput.classList.add('is-disabled');
    }
    cycleInput.addEventListener('input', (event) => { state.meta.callCycle = event.target.value; });
    bindFieldFocus(cycleInput, 'callCycle');
    cycleField.appendChild(cycleInput);
    grid.appendChild(cycleField);

    const laneSchema = getCallLaneSchema(state.meta.callLane);
    if (laneSchema && text(laneSchema.helper)) {
      grid.appendChild(create('p', 'dx-submit-copy dx-submit-copy--compact', text(laneSchema.helper)));
    }
    (Array.isArray(laneSchema?.fields) ? laneSchema.fields : []).forEach((fieldSchema) => {
      const dyn = buildCallDynamicField(fieldSchema);
      if (dyn) grid.appendChild(dyn);
    });

    essentials.appendChild(grid);
    essentials.appendChild(metaTextField('Public materials link', 'link', 'https://drive.google.com/...', 0, true, 'url'));
    frag.appendChild(essentials);
    frag.appendChild(metaTextareaField('Notes for Dex team', 'notes', 'Any constraints, context, or timing notes for this call submission'));
    return frag;
  }

  function buildComposeStep() {
    const section = create('section', 'dx-submit-stage-card dx-submit-compose');
    section.setAttribute('data-dx-submit-step', 'compose');
    const isCallFlow = state.flow === FLOW_CALL;

    section.appendChild(create('p', 'dx-submit-kicker', 'Step 1 of 2'));
    section.appendChild(create('h2', 'dx-submit-title', isCallFlow ? 'Compose your call proposal' : 'Compose your submission'));
    section.appendChild(buildPipelineSwitch());

    if (state.quotaResolved && state.quotaLeft <= 0) section.appendChild(buildQuotaActionCard());

    section.appendChild(isCallFlow ? buildCallComposeBody() : buildSampleComposeBody());

    const actions = create('div', 'dx-submit-stage-actions');
    const next = create('button', 'cta-btn dx-button-element dx-button-size--md dx-button-element--primary', 'Continue to rights & send');
    next.type = 'button';
    next.setAttribute('data-dx-submit-continue', 'compose');
    const quotaLocked = isQuotaLocked();
    next.disabled = quotaLocked;
    next.classList.toggle('is-disabled', quotaLocked);
    next.setAttribute('aria-disabled', quotaLocked ? 'true' : 'false');
    next.addEventListener('click', () => {
      if (!guardQuotaForProgression(true)) { refreshQuotaCopy(); return; }
      if (!validateMeta()) { renderMetaValidationFailure(); return; }
      state.step = STEP_SEND;
      render();
    });
    actions.append(next);
    section.appendChild(actions);
    return section;
  }

  function buildReviewSummary() {
    const box = create('section', 'dx-submit-group dx-submit-review');
    box.appendChild(create('p', 'dx-submit-group-label', 'Review'));
    const isCallFlow = state.flow === FLOW_CALL;
    const rows = isCallFlow
      ? [
        ['Lane', laneLabel(normalizeLane(state.meta.callLane)) || '—'],
        ['Title', text(state.meta.title, '—')],
        ['Creator', text(state.meta.creator, '—')],
        ['Source link', text(state.meta.link, '—')],
      ]
      : [
        ['Title', text(state.meta.title, '—')],
        ['Creator', text(state.meta.creator, '—')],
        ['Category', text(state.meta.category, '—')],
        ['Instrument', text(state.meta.instrument, '—')],
        ['Collection', text(state.meta.collectionType, '—')],
        ['Source link', text(state.meta.link, '—')],
      ];
    const grid = create('div', 'dx-submit-review-grid');
    rows.forEach(([key, value]) => {
      const row = create('div', 'dx-submit-review-row');
      row.append(
        createSidebarText('span', 'dx-submit-review-key', key),
        createSidebarText('span', 'dx-submit-review-val', value),
      );
      grid.appendChild(row);
    });
    box.appendChild(grid);
    return box;
  }

  function buildSendStep() {
    const section = create('section', 'dx-submit-stage-card dx-submit-send');
    section.setAttribute('data-dx-submit-step', 'send');
    const isCallFlow = state.flow === FLOW_CALL;

    section.appendChild(create('p', 'dx-submit-kicker', 'Step 2 of 2'));
    section.appendChild(create('h2', 'dx-submit-title', 'Rights & send'));

    section.appendChild(buildReviewSummary());

    const selected = LICENSE_OPTIONS.find((entry) => entry.id === state.licenseType) || LICENSE_OPTIONS[0];
    const licGroup = create('section', 'dx-submit-group');
    licGroup.appendChild(create('p', 'dx-submit-group-label', 'License'));
    const optionGrid = create('div', 'dx-submit-license-options');
    LICENSE_OPTIONS.forEach((entry) => {
      optionGrid.appendChild(toBadge(entry.label, entry.id === state.licenseType, () => {
        state.licenseType = entry.id;
        render();
      }, false, { focusKey: 'licenseType' }));
    });
    licGroup.appendChild(optionGrid);
    licGroup.appendChild(create('p', 'dx-submit-copy', selected.summary));
    const legal = create('details', 'dx-submit-legal');
    legal.appendChild(create('summary', 'dx-submit-legal-summary', 'Read full license text'));
    const licenseCard = create('article', 'dx-submit-license-card');
    licenseCard.appendChild(create('pre', 'dx-submit-license-pre', selected.copy));
    legal.appendChild(licenseCard);
    licGroup.appendChild(legal);
    section.appendChild(licGroup);

    const rightsGroup = create('section', 'dx-submit-group');
    rightsGroup.appendChild(create('p', 'dx-submit-group-label', 'Rights & signature'));

    const agree = create('label', 'dx-submit-checkbox');
    const accept = create('input');
    accept.type = 'checkbox';
    accept.checked = !!state.licenseConfirmed;
    accept.setAttribute('data-dx-submit-license-accept', 'true');
    accept.addEventListener('change', () => { state.licenseConfirmed = accept.checked; });
    bindFieldFocus(accept, 'licenseConfirmed');
    agree.append(accept, create('span', '', 'I reviewed and accept this license selection.'));
    rightsGroup.appendChild(agree);

    const rights = create('label', 'dx-submit-checkbox');
    const rightsCheckbox = create('input');
    rightsCheckbox.type = 'checkbox';
    rightsCheckbox.checked = !!state.rightsConfirmed;
    rightsCheckbox.setAttribute('data-dx-submit-rights-ack', 'true');
    rightsCheckbox.addEventListener('change', () => { state.rightsConfirmed = rightsCheckbox.checked; });
    bindFieldFocus(rightsCheckbox, 'rightsConfirmed');
    rights.append(rightsCheckbox, create('span', '', 'I confirm this submission is my own original work, or work I am authorized to represent (for example, my band\'s own work), and is not a repost of third-party public-domain material.'));
    rightsGroup.appendChild(rights);

    const signatureField = wrapField('Digital signature (typed full name)', true, 'signatureName');
    const signatureInput = create('input', 'dx-submit-input');
    signatureInput.type = 'text';
    signatureInput.maxLength = 140;
    signatureInput.autocomplete = 'name';
    signatureInput.placeholder = 'Type your full name';
    signatureInput.value = text(state.signatureName);
    signatureInput.setAttribute('data-dx-submit-license-signature', 'true');
    signatureInput.addEventListener('input', (event) => { state.signatureName = event.target.value; });
    bindFieldFocus(signatureInput, 'signatureName');
    signatureField.appendChild(signatureInput);
    rightsGroup.appendChild(signatureField);
    section.appendChild(rightsGroup);

    if (text(state.submitError)) {
      section.appendChild(create('p', 'dx-submit-copy dx-submit-copy--compact', state.submitError));
    }

    const actions = create('div', 'dx-submit-stage-actions');
    const back = create('button', 'cta-btn dx-button-element dx-button-size--sm dx-button-element--secondary', 'Back');
    back.type = 'button';
    back.addEventListener('click', () => { state.step = STEP_COMPOSE; render(); });
    const submit = create('button', 'cta-btn dx-button-element dx-button-size--md dx-button-element--primary', state.submitting ? 'Submitting…' : (isCallFlow ? 'Submit call' : 'Submit sample'));
    submit.type = 'button';
    submit.disabled = state.submitting;
    submit.setAttribute('data-dx-submit-send', 'true');
    submit.addEventListener('click', () => {
      if (!guardQuotaForProgression(true)) return;
      if (!state.licenseConfirmed) { showToast('Please confirm license acceptance.', true); return; }
      if (!state.rightsConfirmed) { showToast('Please confirm ownership/representation acknowledgment.', true); return; }
      if (text(state.signatureName).length < 2) { showToast('Enter your full name as digital signature.', true); return; }
      submitPayload();
    });
    actions.append(back, submit);
    section.appendChild(actions);
    return section;
  }

  function buildDoneStep() {
    const section = create('section', 'dx-submit-stage-card');
    section.setAttribute('data-dx-submit-step', 'done');

    const isCallFlow = state.flow === FLOW_CALL;
    section.appendChild(create('p', 'dx-submit-kicker', isCallFlow ? 'Call submission sent' : 'Submission sent'));
    section.appendChild(
      create(
        'h2',
        'dx-submit-title',
        isCallFlow
          ? 'Call submission received. Timeline is now active.'
          : 'Submission received. Timeline is now active.',
      ),
    );

    const lookup = text(state.lastSubmissionLookup, buildGeneratedSubmissionLookup(state.lastSubmissionRow));

    const badgeRow = create('div', 'dx-submit-pill-group');
    if (lookup) {
      badgeRow.appendChild(create('span', 'dx-submit-pill dx-submit-pill--accent', lookup));
    }
    if (isCallFlow) {
      const lane = normalizeLane(state.meta.callLane);
      if (lane) badgeRow.appendChild(create('span', 'dx-submit-pill', laneLabel(lane)));
      if (lane === 'in-dex-a' && normalizeSubcall(state.meta.callSubcall)) {
        badgeRow.appendChild(create('span', 'dx-submit-pill', `Subcall ${String(state.meta.callSubcall).toUpperCase()}`));
      }
    }
    badgeRow.appendChild(create('span', 'dx-submit-pill', 'Pending review'));
    section.appendChild(badgeRow);

    section.appendChild(
      create(
        'p',
        'dx-submit-copy',
        isCallFlow
          ? 'Open Messages to follow sent/received/reviewing/accepted states, call notes, and publish links when released.'
          : 'Open Messages to follow sent/received/reviewing/accepted states, timeline notes, and publish links when released.',
      ),
    );

    const actions = create('div', 'dx-submit-stage-actions');
    const inbox = create(
      'a',
      'cta-btn dx-button-element dx-button-size--md dx-button-element--primary',
      isCallFlow ? 'Open call messages' : 'Open submission messages',
    );
    inbox.href = '/entry/messages/';

    const restart = create(
      'button',
      'cta-btn dx-button-element dx-button-size--sm dx-button-element--secondary',
      isCallFlow ? 'Start another call submission' : 'Start another submission',
    );
    restart.type = 'button';
    restart.addEventListener('click', () => {
      state.step = 0;
      const resetDraft = baseFlowDraft(state.flow);
      state.flowDrafts[state.flow] = resetDraft;
      state.meta = cloneMeta(resetDraft.meta);
      state.licenseType = resetDraft.licenseType;
      state.licenseConfirmed = resetDraft.licenseConfirmed;
      state.rightsConfirmed = resetDraft.rightsConfirmed;
      state.signatureName = resetDraft.signatureName;
      state.lastSubmissionId = '';
      state.lastSubmissionRow = '000';
      state.lastSubmissionLookup = '';
      render();
    });

    actions.append(inbox, restart);
    section.appendChild(actions);

    return section;
  }

  function buildStepContent() {
    if (state.step === STEP_COMPOSE) return buildComposeStep();
    if (state.step === STEP_SEND) return buildSendStep();
    return buildDoneStep();
  }

  function getRequiredChecks() {
    return state.flow === FLOW_CALL
      ? [
        ['Title', text(state.meta.title).length > 0],
        ['Creator', text(state.meta.creator).length > 0],
        ['Call lane', text(state.meta.callLane).length > 0],
        ['Proposal format', text(state.meta.proposalFormat).length > 0],
        ['Source link', text(state.meta.link).length > 0],
      ]
      : [
        ['Title', text(state.meta.title).length > 0],
        ['Creator', text(state.meta.creator).length > 0],
        ['Category', text(state.meta.category).length > 0],
        ['Instrument', text(state.meta.instrument).length > 0],
        ['Collection type', text(state.meta.collectionType).length > 0],
        ['Source link', text(state.meta.link).length > 0],
      ];
  }

  function buildChecklist() {
    const list = create('ul', 'dx-submit-checklist');
    getRequiredChecks().forEach(([label, ok]) => {
      const item = createSidebarText('li', 'dx-submit-check-item', label);
      item.classList.add(ok ? 'is-done' : 'is-pending');
      list.appendChild(item);
    });
    return list;
  }

  function buildReadinessCard() {
    const checks = getRequiredChecks();
    const done = checks.filter(([, ok]) => ok).length;
    const total = checks.length || 1;
    const ratio = Math.max(0, Math.min(1, done / total));
    const card = create('section', 'dx-submit-command-card');
    card.append(
      createSidebarText('p', 'dx-submit-kicker', 'Readiness'),
      createSidebarText('h3', 'dx-submit-command-title', `${done} of ${total} essentials`),
    );
    const meter = create('div', 'dx-submit-readiness');
    const fill = create('span', 'dx-submit-readiness-fill');
    fill.style.transform = `scaleX(${ratio})`;
    if (ratio >= 1) meter.classList.add('is-complete');
    meter.appendChild(fill);
    card.appendChild(meter);

    if (state.flow !== FLOW_CALL) {
      const preview = buildGeneratedSubmissionLookup(Math.max(1, Number(state.weeklyUsed || 0) + 1));
      const lookup = createSidebarText('p', 'dx-submit-copy dx-submit-copy--compact', `Lookup preview: ${preview}`);
      lookup.classList.add('dx-submit-lookup-preview');
      card.appendChild(lookup);
    }
    return card;
  }

  function resolveFocusedGuidance() {
    const byField = FIELD_GUIDANCE[state.focusedField];
    if (byField) return byField;
    const stepKey = STEPS[state.step]?.key || 'compose';
    const callStepGuidance = {
      compose: 'Pick your lane, add lane-fit metadata, and attach one stable materials link.',
      send: 'Rights acknowledgment and digital signature are required for call submissions.',
      done: 'Track call decisions and notes from your Messages timeline.',
    };
    return {
      title: `Step guidance: ${STEPS[state.step]?.title || 'Submission'}`,
      body: state.flow === FLOW_CALL ? callStepGuidance[stepKey] || '' : STEP_GUIDANCE[stepKey] || '',
    };
  }

  function buildCommandPanel() {
    const aside = create('aside', 'dx-submit-command dx-submit-surface');
    const isCallFlow = state.flow === FLOW_CALL;

    const readiness = buildReadinessCard();

    const cycle = create('section', 'dx-submit-command-card');
    cycle.append(
      createSidebarText('p', 'dx-submit-kicker', 'Review SLA'),
      createSidebarText('h3', 'dx-submit-command-title', isCallFlow ? 'Call review target: within 7 days' : 'Typical review within 7 days'),
      createSidebarText(
        'p',
        'dx-submit-copy dx-submit-copy--compact',
        `${quotaSummaryText()}. Status updates post to your inbox timeline with timestamps and notes.`,
      ),
    );

    const license = LICENSE_OPTIONS.find((entry) => entry.id === state.licenseType) || LICENSE_OPTIONS[0];
    const licenseCard = create('section', 'dx-submit-command-card');
    licenseCard.append(
      createSidebarText('p', 'dx-submit-kicker', 'License summary'),
      createSidebarText('h3', 'dx-submit-command-title', license.label),
      createSidebarText('p', 'dx-submit-copy dx-submit-copy--compact', license.summary),
    );

    const modeCard = create('section', 'dx-submit-command-card');
    if (isCallFlow) {
      const lane = normalizeLane(state.meta.callLane);
      const laneName = lane ? laneLabel(lane) : 'Select lane';
      modeCard.append(
        createSidebarText('p', 'dx-submit-kicker', 'Call lane'),
        createSidebarText('h3', 'dx-submit-command-title', laneName),
        createSidebarText(
          'p',
          'dx-submit-copy dx-submit-copy--compact',
          lane && lane === 'in-dex-a' && normalizeSubcall(state.meta.callSubcall)
            ? `Subcall ${String(state.meta.callSubcall).toUpperCase()} selected.`
            : 'Use lane-specific fields to clarify call fit.',
        ),
      );
    } else {
      modeCard.append(
        createSidebarText('p', 'dx-submit-kicker', 'Pitch profile'),
        createSidebarText('h3', 'dx-submit-command-title', summarizePitch(state.meta)),
        createSidebarText(
          'p',
          'dx-submit-copy dx-submit-copy--compact',
          'Use the pitch-root dropdown for 12-TET and 24-TET, or describe JI context. Atonal and non-pitched are first-class options.',
        ),
      );
    }

    const checklist = create('section', 'dx-submit-command-card');
    checklist.append(
      createSidebarText('p', 'dx-submit-kicker', 'Required fields'),
      buildChecklist(),
    );

    const quality = create('section', 'dx-submit-command-card');
    quality.append(
      createSidebarText('p', 'dx-submit-kicker', isCallFlow ? 'Call intake targets' : 'Capture targets'),
      createSidebarText(
        'p',
        'dx-submit-copy dx-submit-copy--compact',
        isCallFlow
          ? 'Use one stable link, clear format/runtime context, and notes staff can action immediately.'
          : 'Video: 3840×2160, H.265, 24fps. Audio: 48kHz, 24-bit WAV. Lower-res accepted.',
      ),
    );

    const guide = create('section', 'dx-submit-command-card');
    const focused = resolveFocusedGuidance();
    guide.append(
      createSidebarText('p', 'dx-submit-kicker', state.focusedField ? 'Focused field guidance' : 'Current step guidance'),
      createSidebarText('h3', 'dx-submit-command-title', focused.title),
      createSidebarText('p', 'dx-submit-copy dx-submit-copy--compact', focused.body),
    );

    aside.append(readiness, cycle, licenseCard, modeCard, checklist, quality, guide);
    return aside;
  }

  function refreshCommandPanel() {
    if (!(liveRoot instanceof HTMLElement) || !state) return;
    const current = liveRoot.querySelector('.dx-submit-command');
    if (!(current instanceof HTMLElement)) return;
    current.replaceWith(buildCommandPanel());
  }

  function refreshQuotaCopy() {
    if (!(liveRoot instanceof HTMLElement) || !state) return;
    const continueBtn = liveRoot.querySelector('[data-dx-submit-continue]');
    if (continueBtn instanceof HTMLButtonElement) {
      const quotaLocked = isQuotaLocked();
      continueBtn.disabled = quotaLocked;
      continueBtn.classList.toggle('is-disabled', quotaLocked);
      continueBtn.setAttribute('aria-disabled', quotaLocked ? 'true' : 'false');
    }

    const compose = liveRoot.querySelector('[data-dx-submit-step="compose"]');
    if (compose instanceof HTMLElement) {
      const existingCard = compose.querySelector('.dx-submit-action-card');
      if (state.quotaResolved && state.quotaLeft <= 0) {
        if (!(existingCard instanceof HTMLElement)) {
          const body = compose.querySelector('.dx-submit-switch');
          const card = buildQuotaActionCard();
          if (body instanceof HTMLElement && body.nextSibling) compose.insertBefore(card, body.nextSibling);
          else compose.appendChild(card);
        }
      } else if (existingCard instanceof HTMLElement) {
        existingCard.remove();
      }
    }

    refreshCommandPanel();
  }

  function applySubmitBusyLock(root) {
    if (!(root instanceof HTMLElement) || !state) return;
    const submitting = !!state.submitting;
    if (submitting) {
      root.setAttribute('data-dx-submit-submitting', 'true');
      root.setAttribute('aria-busy', 'true');
    } else {
      root.removeAttribute('data-dx-submit-submitting');
      if (root.getAttribute('data-dx-fetch-state') !== FETCH_STATE_LOADING) {
        root.removeAttribute('aria-busy');
      }
      return;
    }

    root.querySelectorAll('button,input,select,textarea').forEach((node) => {
      if (
        node instanceof HTMLButtonElement
        || node instanceof HTMLInputElement
        || node instanceof HTMLSelectElement
        || node instanceof HTMLTextAreaElement
      ) {
        node.disabled = true;
      }
    });

    root.querySelectorAll('a').forEach((node) => {
      if (!(node instanceof HTMLAnchorElement)) return;
      node.setAttribute('aria-disabled', 'true');
      node.setAttribute('tabindex', '-1');
      node.classList.add('is-disabled');
    });
  }

  // Commit a lane choice from the step-0 gate, then drop into that lane's compose.
  function chooseLane(flowKey, laneId) {
    if (!state) return;
    state.pipelineChosen = true;
    const flow = normalizeFlow(flowKey);
    if (flow === FLOW_CALL) {
      const callDraft = getFlowDraft(FLOW_CALL);
      callDraft.meta.callLane = normalizeLane(laneId);
      setActiveFlow(FLOW_CALL, { force: true, resetStep: true, refreshQuota: true });
    } else {
      setActiveFlow(FLOW_SAMPLE, { force: true, resetStep: true, refreshQuota: true });
    }
  }

  function buildGateCard({ kicker, title, body, meta, image, imageAlt, imageFit, onChoose }) {
    const card = create('button', 'dx-submit-gate-card');
    card.type = 'button';
    card.setAttribute('data-dx-submit-gate-choice', 'true');

    if (image) {
      const media = create('span', `dx-submit-gate-media${imageFit === 'contain' ? ' dx-submit-gate-media--contain' : ''}`);
      const img = document.createElement('img');
      img.className = 'dx-submit-gate-img';
      img.src = image;
      img.alt = text(imageAlt, '');
      img.loading = 'lazy';
      img.decoding = 'async';
      media.appendChild(img);
      card.appendChild(media);
    }

    const copy = create('span', 'dx-submit-gate-copy');
    copy.append(
      create('span', 'dx-submit-gate-kicker', kicker),
      create('span', 'dx-submit-gate-title', title),
      create('span', 'dx-submit-gate-body', body),
    );
    if (meta) copy.appendChild(create('span', 'dx-submit-gate-meta', meta));
    copy.appendChild(create('span', 'dx-submit-gate-cta', 'Choose →'));
    card.appendChild(copy);

    if (typeof onChoose === 'function') card.addEventListener('click', onChoose);
    return card;
  }

  // Step 0 — the lane chooser. Shown full-shell (no command rail / progress) so a
  // submitter explicitly picks where their work is going before composing.
  function buildFlowGate() {
    const shell = create('div', 'dx-submit-shell dx-submit-shell--gate');
    shell.setAttribute('data-dx-submit-shell', 'true');
    shell.setAttribute('data-dx-submit-current-step', 'flow-gate');
    shell.setAttribute('data-dx-submit-pipeline-choice', 'pending');
    shell.setAttribute('data-dx-submit-flow', normalizeFlow(state.flow));
    shell.setAttribute('data-dx-submit-has-active-call', state.hasActiveCall ? 'true' : 'false');
    shell.setAttribute('data-dx-submit-active-call-count', String(Math.max(0, Number(state.activeCallCount || 0))));

    const main = create('section', 'dx-submit-main dx-submit-surface dx-submit-gate');
    main.setAttribute('data-dx-submit-step', 'flow-gate');

    const heading = create('header', 'dx-submit-heading');
    heading.append(
      create('p', 'dx-submit-kicker', 'Submit'),
      create('h1', 'dx-submit-heading-title', 'Where are you submitting?'),
      create(
        'p',
        'dx-submit-copy',
        'Pick a lane to begin. Each one routes your work to the right queue and reviewers — you can switch later.',
      ),
    );
    main.appendChild(heading);

    const grid = create('div', 'dx-submit-gate-grid');
    grid.appendChild(buildGateCard({
      kicker: 'Open library',
      title: 'Sample submission',
      body: 'Add a recording to the Dex library. We split it into labelled A–E sections (plus X) so it is searchable and release-ready.',
      meta: 'Always open · weekly quota applies',
      image: '/assets/catalog/snare-drum-matt-leveque.jpg',
      imageAlt: 'A Dex catalog performer recording session',
      onChoose: () => chooseLane(FLOW_SAMPLE, ''),
    }));

    getAvailableCallLanes().forEach((lane) => {
      const laneId = normalizeLane(lane?.id);
      if (!laneId) return;
      const cycle = text(state.activeCallCycleByLane?.[laneId], '');
      grid.appendChild(buildGateCard({
        kicker: 'IN DEX call',
        title: text(lane?.label, laneLabel(laneId)),
        body: text(lane?.helper, 'Lane-specific call proposal routed to the IN DEX panel.'),
        meta: cycle ? `Active cycle · ${cycle}` : 'Active call',
        image: '/assets/series/index.png',
        imageAlt: 'IN DEX program',
        imageFit: 'contain',
        onChoose: () => chooseLane(FLOW_CALL, laneId),
      }));
    });

    main.appendChild(grid);
    shell.appendChild(main);
    return shell;
  }

  function buildLayout() {
    if (!state.pipelineChosen && state.hasActiveCall) return buildFlowGate();
    const currentStep = STEPS[state.step]?.key || 'compose';
    const isCallFlow = state.flow === FLOW_CALL;
    const shell = create('div', 'dx-submit-shell');
    shell.setAttribute('data-dx-submit-shell', 'true');
    shell.setAttribute('data-dx-submit-current-step', currentStep);
    shell.setAttribute('data-dx-submit-pipeline-choice', 'selected');
    shell.setAttribute('data-dx-submit-flow', normalizeFlow(state.flow));
    shell.setAttribute('data-dx-submit-lane', normalizeLane(state.meta?.callLane || ''));
    shell.setAttribute('data-dx-submit-has-active-call', state.hasActiveCall ? 'true' : 'false');
    shell.setAttribute('data-dx-submit-active-call-count', String(Math.max(0, Number(state.activeCallCount || 0))));
    if (normalizeSubcall(state.meta?.callSubcall || '')) {
      shell.setAttribute('data-dx-submit-subcall', normalizeSubcall(state.meta.callSubcall));
    }

    const main = create('section', 'dx-submit-main dx-submit-surface');
    const heading = create('header', 'dx-submit-heading');
    heading.append(
      create('p', 'dx-submit-kicker', isCallFlow ? 'Submit Calls' : 'Submit Samples'),
      create('h1', 'dx-submit-heading-title', isCallFlow ? 'Call intake + tracker' : 'Sample intake + tracker'),
      create(
        'p',
        'dx-submit-copy dx-submit-copy--compact',
        isCallFlow
          ? 'Submit lane-ready call proposals. Follow status from sent to in-library in Messages.'
          : 'Compose once, sign, send. Follow status from sent to in-library in Messages.',
      ),
    );

    const stageWrap = create('div', 'dx-submit-stage');
    stageWrap.setAttribute('data-dx-submit-stage', currentStep);
    stageWrap.appendChild(buildStepContent());

    main.appendChild(heading);
    main.appendChild(buildProgressHeader());
    main.appendChild(stageWrap);

    shell.append(main, buildCommandPanel());
    return shell;
  }

  function applyMotion(root) {
    if (isReducedMotion()) return;

    const stageCard = root.querySelector('.dx-submit-stage-card');
    if (stageCard instanceof HTMLElement) {
      animate(stageCard, { opacity: [0, 1], y: [16, 0] }, { duration: 0.32, ease: 'easeOut' });
    }

    const commandCards = Array.from(root.querySelectorAll('.dx-submit-command-card'));
    commandCards.forEach((card, index) => {
      animate(card, { opacity: [0, 1], y: [10, 0] }, { duration: 0.24, delay: index * 0.03, ease: 'easeOut' });
    });

    const fill = root.querySelector('.dx-submit-progress-fill');
    if (fill instanceof HTMLElement) {
      const nextProgress = (state.step + 1) / STEPS.length;
      animate(
        fill,
        { transform: [`scaleX(${state.prevProgress})`, `scaleX(${nextProgress})`] },
        { duration: 0.28, ease: 'easeOut' },
      );
      state.prevProgress = nextProgress;
    }
  }

  function buildPayload() {
    const estimatedCounter = Math.max(1, Number(state.weeklyUsed || 0) + 1);
    const generatedLookup = buildGeneratedSubmissionLookup(estimatedCounter);
    const lane = normalizeLane(state.meta.callLane);
    const laneToCategory = {
      'in-dex-a': 'V - Voice + Body',
      'in-dex-b': 'E - Electronics',
      'in-dex-c': 'X - Other',
      'mini-dex': 'W - Winds',
    };
    const laneToInstrument = {
      'in-dex-a': 'Call Proposal',
      'in-dex-b': 'Composite Proposal',
      'in-dex-c': 'Community Contribution',
      'mini-dex': 'Field Recording',
    };

    if (state.flow === FLOW_CALL) {
      return {
        action: activeSubmitAction(),
        auth0Sub: text(state.auth0Sub),
        title: text(state.meta.title),
        creator: text(state.meta.creator),
        category: laneToCategory[lane] || 'X - Other',
        instrument: laneToInstrument[lane] || 'Call Submission',
        collectionType: 'O',
        license: text(state.licenseType, 'joint'),
        licenseAccepted: state.licenseConfirmed ? 'yes' : 'no',
        rightsAcknowledged: state.rightsConfirmed ? 'yes' : 'no',
        digitalSignatureName: text(state.signatureName),
        link: text(state.meta.link),
        notes: text(state.meta.notes),
        submissionYear: String(new Date().getFullYear()),
        performerToken: parsePerformerToken(),
        submissionLookupNumber: generatedLookup,
        finalLookupNumber: '',
        status: 'pending',
        sourceRoute: '/entry/submit',
        sourceType: 'call',
        submissionKind: 'call',
        callLane: lane,
        callSubcall: normalizeSubcall(state.meta.callSubcall),
        callCycle: text(state.meta.callCycle),
        proposalFormat: text(state.meta.proposalFormat),
        runtimeMinutes: text(state.meta.runtimeMinutes),
        availabilityWindow: text(state.meta.availabilityWindow),
        portfolioUrl: text(state.meta.portfolioUrl),
        clientRequestId: typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
          ? crypto.randomUUID()
          : `dxcall_${Date.now()}_${Math.floor(Math.random() * 1_000_000)}`,
      };
    }

    syncLegacyPitchFields(state.meta);
    return {
      action: activeSubmitAction(),
      auth0Sub: text(state.auth0Sub),
      title: text(state.meta.title),
      creator: text(state.meta.creator),
      category: text(state.meta.category),
      instrument: text(state.meta.instrument),
      bpm: text(state.meta.bpm),
      pitchSystem: text(state.meta.pitchSystem),
      pitchDescriptor: text(state.meta.pitchDescriptor),
      keyCenter: text(state.meta.keyCenter),
      scaleQuality: text(state.meta.scaleQuality),
      tags: text(state.meta.tags),
      collectionType: text(state.meta.collectionType),
      outputTypes: (Array.isArray(state.meta.outputTypes) ? state.meta.outputTypes : []).join(','),
      services: (Array.isArray(state.meta.services) ? state.meta.services : []).join(','),
      license: text(state.licenseType, 'joint'),
      licenseAccepted: state.licenseConfirmed ? 'yes' : 'no',
      rightsAcknowledged: state.rightsConfirmed ? 'yes' : 'no',
      digitalSignatureName: text(state.signatureName),
      link: text(state.meta.link),
      notes: text(state.meta.notes),
      submissionYear: String(new Date().getFullYear()),
      performerToken: parsePerformerToken(),
      submissionLookupNumber: generatedLookup,
      finalLookupNumber: '',
      status: 'pending',
      submissionKind: 'sample',
      sourceType: 'sample',
    };
  }

  async function submitPayload() {
    if (state.submitting) return;
    if (!text(state.meta.link)) {
      showToast('Missing link', true);
      return;
    }

    state.submitting = true;
    state.submitError = '';
    render();
    const submitStartTs = performance.now();

    const quotaVerified = await refreshWeeklyQuotaFromSheet({
      useCache: false,
      forceLive: true,
      allowRetry: false,
      timeoutMs: SUBMIT_QUOTA_VERIFY_TIMEOUT_MS,
    });
    if (!quotaVerified) {
      state.submitting = false;
      state.submitError = describeQuotaFailure();
      render();
      showToast(state.submitError, true);
      refreshQuotaCopy();
      return;
    }
    if (!guardQuotaForProgression(true)) {
      state.submitting = false;
      render();
      refreshQuotaCopy();
      return;
    }

    await resolveAuthUser(Math.min(AUTH_TIMEOUT_MS, 2200));
    const payload = buildPayload();
    const ticket = Date.now();
    state.submitTicket = ticket;
    let settled = false;

    function onResolved(success, responsePayload = null, failureCode = '') {
      if (settled) return;
      settled = true;

      const finish = () => {
        if (state.submitTicket !== ticket) return;
        state.submitting = false;

        if (success) {
          const rowNumber = responsePayload && typeof responsePayload === 'object'
            ? (responsePayload.row ?? responsePayload.sourceRow ?? '')
            : '';
          state.lastSubmissionId = responsePayload && typeof responsePayload === 'object'
            ? text(responsePayload.submissionId ?? responsePayload.submission_id, '')
            : '';
          if (state.lastSubmissionId) {
            window.__dxPendingSubmissionSid = state.lastSubmissionId;
            window.__dxPendingMessageThread = { kind: 'submission', sid: state.lastSubmissionId };
            try {
              window.sessionStorage.setItem('dex:messages:pending-submission-sid', state.lastSubmissionId);
              window.sessionStorage.setItem('dex:messages:pending-thread:v1', JSON.stringify({ kind: 'submission', sid: state.lastSubmissionId }));
            } catch {}
          }
          state.lastSubmissionRow = String(rowNumber || '').padStart(3, '0') || '000';
          state.lastSubmissionLookup = resolveLookupFromSubmitResponse(responsePayload, rowNumber || state.lastSubmissionRow);
          const payloadWeeklyLimit = parsePositiveInt(
            responsePayload && typeof responsePayload === 'object' ? responsePayload.weeklyLimit : null,
            null,
          );
          const payloadWeeklyRemaining = parsePositiveInt(
            responsePayload && typeof responsePayload === 'object' ? responsePayload.weeklyRemaining : null,
            null,
          );
          const payloadWeeklyUsed = parsePositiveInt(
            responsePayload && typeof responsePayload === 'object' ? responsePayload.weeklyUsed : null,
            null,
          );
          if (payloadWeeklyLimit !== null) {
            state.weeklyLimit = Math.max(1, Math.min(99, payloadWeeklyLimit));
          }
          if (payloadWeeklyRemaining !== null) {
            state.quotaLeft = Math.max(0, Math.min(state.weeklyLimit, payloadWeeklyRemaining));
            state.weeklyUsed = Math.max(0, state.weeklyLimit - state.quotaLeft);
          } else if (payloadWeeklyUsed !== null) {
            state.weeklyUsed = Math.max(0, payloadWeeklyUsed);
            state.quotaLeft = Math.max(0, state.weeklyLimit - state.weeklyUsed);
          } else {
            state.weeklyUsed += 1;
            state.quotaLeft = Math.max(0, state.weeklyLimit - state.weeklyUsed);
          }
          state.quotaResolved = true;
          clearActiveStoredDrafts();
          state.step = STEP_DONE;
          render();
          showToast(state.flow === FLOW_CALL ? 'Call submitted' : 'Submitted');
          void refreshAchievementsAfterSubmit();
        } else {
          state.submitError = describeSubmitFailure(responsePayload, failureCode);
          render();
          showToast(state.submitError, true);
        }
      };

      const elapsed = performance.now() - submitStartTs;
      const remaining = Math.max(0, SUBMIT_MIN_LOADING_MS - elapsed);
      if (remaining > 0) {
        window.setTimeout(finish, remaining);
      } else {
        finish();
      }
    }

    try {
      const response = await fetchWorkerJson('/me/submissions', {
        method: 'POST',
        body: payload,
        timeoutMs: SUBMIT_TIMEOUT_MS,
      });
      if (response && response.status === 'ok') {
        onResolved(true, response);
      } else {
        onResolved(false, response, 'submit_rejected');
      }
    } catch (error) {
      onResolved(false, { error: text(error?.message, 'submit request failed') }, 'submit_rejected');
    }
  }

  function syncRootFlowAttrs() {
    if (!(liveRoot instanceof HTMLElement) || !state) return;
    const flow = normalizeFlow(state.flow);
    const lane = normalizeLane(state.meta?.callLane || '');
    const subcall = normalizeSubcall(state.meta?.callSubcall || '');
    liveRoot.setAttribute('data-dx-submit-pipeline-choice', state.pipelineChosen ? 'selected' : 'pending');
    liveRoot.setAttribute('data-dx-submit-flow', flow);
    liveRoot.setAttribute('data-dx-submit-lane', lane);
    liveRoot.setAttribute('data-dx-submit-has-active-call', state.hasActiveCall ? 'true' : 'false');
    liveRoot.setAttribute('data-dx-submit-active-call-count', String(Math.max(0, Number(state.activeCallCount || 0))));
    if (subcall) liveRoot.setAttribute('data-dx-submit-subcall', subcall);
    else liveRoot.removeAttribute('data-dx-submit-subcall');
  }

  function render() {
    if (!(liveRoot instanceof HTMLElement) || !state) return;

    persistActiveFlowDraft();
    syncRootFlowAttrs();
    hideSubmitTooltip();
    liveRoot.innerHTML = '';
    liveRoot.appendChild(buildLayout());
    const toastStack = create('div', 'dx-submit-toast-stack');
    toastStack.setAttribute('data-dx-submit-toasts', 'true');
    liveRoot.appendChild(toastStack);
    applySubmitBusyLock(liveRoot);

    applyMotion(liveRoot);
    bindSubmitTooltips(liveRoot);
  }

  async function resolveAuth0Sub(timeoutMs = AUTH_TIMEOUT_MS) {
    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
      if (text(window.auth0Sub)) return text(window.auth0Sub);

      if (window.DEX_AUTH && typeof window.DEX_AUTH.getUser === 'function') {
        try {
          const user = await withTimeout(window.DEX_AUTH.getUser(), Math.min(timeoutMs, 1200), null);
          const subject = extractAuthSubject(user);
          if (subject) return subject;
        } catch {}
      }

      if (window.auth0 && typeof window.auth0.getUser === 'function') {
        try {
          const candidate = window.auth0.getUser();
          const user = candidate && typeof candidate.then === 'function' ? await candidate : candidate;
          const subject = extractAuthSubject(user);
          if (subject) return subject;
        } catch {}
      }

      if (window.AUTH0_USER && typeof window.AUTH0_USER === 'object') {
        const subject = extractAuthSubject(window.AUTH0_USER);
        if (subject) return subject;
      }

      await delay(100);
    }
    return '';
  }

  let quotaHydrationPromise = null;

  async function hydrateAuthAndQuota(options = {}) {
    if (!state) return false;
    const opts = options && typeof options === 'object' ? options : {};
    if (quotaHydrationPromise) return quotaHydrationPromise;

    quotaHydrationPromise = (async () => {
      const sub = await resolveAuth0Sub(AUTH_TIMEOUT_MS);
      if (!text(sub)) {
        // Keep the last known quota on transient auth races; only reset when nothing was resolved yet.
        if (!state.quotaResolved) {
          state.auth0Sub = '';
          setQuotaSource('none');
          refreshQuotaCopy();
        }
        return false;
      }
      if (state.auth0Sub !== sub) {
        state.auth0Sub = sub;
        window.auth0Sub = sub;
        reconcileDraftsForSub(sub);
      }
      state.authUser = await resolveAuthUser(Math.min(AUTH_TIMEOUT_MS, 2200));
      prefillSignatureFromAuth();
      await hydrateSubmitProfileDefaults({ force: !!opts.forceLive });
      const verified = await refreshWeeklyQuotaFromSheet({
        useCache: true,
        forceLive: !!opts.forceLive,
        allowRetry: true,
      });
      refreshQuotaCopy();
      return verified;
    })()
      .catch(() => false)
      .finally(() => {
        quotaHydrationPromise = null;
      });

    return quotaHydrationPromise;
  }

  async function mount(options = {}) {
    const root = document.getElementById('dex-submit');
    if (!(root instanceof HTMLElement)) return false;

    const force = !!options.force;
    if (root.getAttribute('data-dx-submit-booting') === 'true') return false;
    if (!force && root.getAttribute('data-dx-submit-mounted') === 'true') return true;

    root.setAttribute('data-dx-submit-booting', 'true');
    const startTs = performance.now();

    try {
      liveRoot = root;
      // Persist drafts as the user types: field listeners mutate state without a
      // re-render, so hook input/change once at the stable root element.
      if (!root.__dxDraftBound) {
        root.__dxDraftBound = true;
        root.addEventListener('input', () => persistActiveFlowDraft());
        root.addEventListener('change', () => persistActiveFlowDraft());
      }
      setFetchState(root, FETCH_STATE_LOADING);
      const config = toConfig(root);
      state = makeState(config);
      state.auth0Sub = text(window.auth0Sub, '');
      hydrateStoredDrafts(state.auth0Sub || '');
      setQuotaSource('none');
      render();
      const schemaPromise = loadCallSchema().catch(() => {});
      const callsRegistryPromise = loadCallsRegistry().catch(() => {});
      await Promise.all([schemaPromise, callsRegistryPromise]);
      render();
      hydrateAuthAndQuota({ forceLive: false }).catch(() => {});
      await finalizeFetchState(root, startTs, FETCH_STATE_READY);
      root.setAttribute('data-dx-submit-mounted', 'true');
      return true;
    } catch (error) {
      root.innerHTML = '';
      const pane = create('section', 'dx-submit-main dx-submit-surface');
      pane.appendChild(create('h2', 'dx-submit-title', 'Submit page failed to load'));
      pane.appendChild(create('p', 'dx-submit-copy', text(error?.message, 'Unknown error')));
      root.appendChild(pane);
      await finalizeFetchState(root, startTs, FETCH_STATE_ERROR);
      return false;
    } finally {
      root.removeAttribute('data-dx-submit-booting');
    }
  }

  window.__dxSubmitSamplesMount = mount;

  document.addEventListener('dx:slotready', () => {
    mount().catch(() => {});
  });

  document.addEventListener('dex-auth:ready', () => {
    if (!state) return;
    hydrateAuthAndQuota({ forceLive: true }).catch(() => {});
  });

  window.addEventListener('dx:prefetch:update', (event) => {
    if (!state) return;
    const detail = event && typeof event.detail === 'object' ? event.detail : null;
    const key = text(detail?.key, '');
    if (!key || key !== getQuotaPrefetchKey(state.auth0Sub, state.flow)) return;
    const cached = readCachedQuota(state.auth0Sub, state.flow);
    if (!cached) return;
    if (applyQuotaPayload(cached)) {
      setQuotaSource('cache');
      refreshQuotaCopy();
    }
  });

  window.addEventListener('dx:profile:updated', (event) => {
    if (!state) return;
    const detail = event && typeof event.detail === 'object' ? event.detail : null;
    if (!detail) return;
    state.profileDefaults = normalizeSubmitProfileDefaults(detail);
    state.profileDefaultsLoaded = true;
    if (state.step === STEP_COMPOSE) {
      render();
    }
  });

  if (document.readyState === 'loading') {
    document.addEventListener(
      'DOMContentLoaded',
      () => {
        mount().catch(() => {});
      },
      { once: true },
    );
  } else {
    mount().catch(() => {});
  }
})();
