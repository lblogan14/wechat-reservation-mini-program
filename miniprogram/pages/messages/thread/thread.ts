import { t, onLocaleChange } from '../../../i18n/index';
import { getOpenid } from '../../../services/openid';
import { messageList, messageSend, messageMarkRead } from '../../../services/message';

interface MsgRow {
  _id: string;
  body: string;
  timeStr: string;
  mine: boolean;
  attachmentFileID?: string;
}

const POLL_INTERVAL_MS = 10_000;

function fmt(ts: number): string {
  const d = new Date(ts);
  const yyyy = d.getUTCFullYear();
  const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(d.getUTCDate()).padStart(2, '0');
  const hh = String(d.getUTCHours()).padStart(2, '0');
  const mi = String(d.getUTCMinutes()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd} ${hh}:${mi}`;
}

Page({
  data: {
    titleText: '',
    inputPlaceholder: '',
    sendLabel: '',
    emptyText: '',
    loadFailedText: '',
    messages: [] as MsgRow[],
    draft: '',
    sending: false,
    threadId: '',
    scrollIntoView: '',
    notSignedIn: false,
    loginRequiredText: '',
    loginCta: '',
  },

  unsubscribe: undefined as (() => void) | undefined,
  poller: 0 as ReturnType<typeof setInterval> | 0,
  lastSeenAt: 0,

  async onLoad(opts: Record<string, string | undefined>) {
    if (!opts.id) {
      wx.showToast({ title: 'Missing thread id', icon: 'error' });
      return;
    }
    this.setData({ threadId: opts.id, titleText: t('messages_title') });
    this.refreshStrings();
    this.unsubscribe = onLocaleChange(() => this.refreshStrings());

    if (!getOpenid()) {
      this.setData({ notSignedIn: true });
      return;
    }

    await this.fetch(true);
    await messageMarkRead(opts.id);
  },

  onShow() {
    if (!this.data.threadId || this.data.notSignedIn) return;
    this.startPolling();
  },

  onHide() {
    this.stopPolling();
  },

  onUnload() {
    this.unsubscribe?.();
    this.stopPolling();
  },

  refreshStrings() {
    this.setData({
      titleText: t('messages_title'),
      inputPlaceholder: t('messages_thread_input_ph'),
      sendLabel: t('messages_thread_send'),
      emptyText: t('messages_thread_empty'),
      loadFailedText: t('messages_thread_load_failed'),
      loginRequiredText: t('booking_login_required'),
      loginCta: t('booking_required_login_cta'),
    });
  },

  startPolling() {
    this.stopPolling();
    this.poller = setInterval(() => this.fetch(false), POLL_INTERVAL_MS);
  },

  stopPolling() {
    if (this.poller) {
      clearInterval(this.poller);
      this.poller = 0;
    }
  },

  async fetch(initial: boolean) {
    const res = await messageList(this.data.threadId);
    if (!res.ok || !res.messages) {
      if (initial) wx.showToast({ title: this.data.loadFailedText, icon: 'none' });
      return;
    }
    const myOpenid = getOpenid();
    const rows: MsgRow[] = res.messages.map((m) => ({
      _id: m._id!,
      body: m.body,
      timeStr: fmt(m.createdAt),
      mine: m.fromOpenid === myOpenid,
      attachmentFileID: m.attachmentFileID,
    }));
    const lastId = rows.length ? rows[rows.length - 1]._id : '';
    const hasNew = rows.length && this.data.messages.length !== rows.length;
    this.setData({ messages: rows });
    if (hasNew && lastId) {
      this.setData({ scrollIntoView: `msg-${lastId}` });
      // If this isn't the initial fetch, also mark new messages as read.
      if (!initial) await messageMarkRead(this.data.threadId);
    } else if (initial && lastId) {
      this.setData({ scrollIntoView: `msg-${lastId}` });
    }
  },

  onDraftInput(e: WechatMiniprogram.Input) {
    this.setData({ draft: e.detail.value });
  },

  async onSend() {
    const body = this.data.draft.trim();
    if (!body || this.data.sending) return;
    this.setData({ sending: true });
    const res = await messageSend({ threadId: this.data.threadId, body });
    this.setData({ sending: false });
    if (!res.ok) {
      wx.showToast({ title: res.error || t('messages_thread_send_failed'), icon: 'error' });
      return;
    }
    this.setData({ draft: '' });
    await this.fetch(false);
  },

  goSignIn() {
    wx.switchTab({ url: '/pages/profile/profile' });
  },
});
