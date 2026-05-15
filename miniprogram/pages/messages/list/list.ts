import { t, getLocale, onLocaleChange } from '../../../i18n/index';
import { getOpenid } from '../../../services/openid';
import { isOwner, refreshCurrentUser } from '../../../services/user';
import { messageThreadList, type EnrichedMessageThread } from '../../../services/message';

interface ThreadRow {
  _id: string;
  title: string;
  about: string;
  preview: string;
  unread: number;
  timeStr: string;
}

function localized(zh: string | undefined, en: string | undefined): string {
  const loc = getLocale();
  if (loc === 'en') return en || zh || '';
  return zh || en || '';
}

function fmtDate(ts: number | undefined): string {
  if (!ts) return '';
  const d = new Date(ts);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
}

function fmtRelative(ts: number): string {
  if (!ts) return '';
  const diff = Date.now() - ts;
  const minute = 60 * 1000;
  const hour = 60 * minute;
  const day = 24 * hour;
  if (diff < minute) return 'just now';
  if (diff < hour) return `${Math.floor(diff / minute)}m`;
  if (diff < day) return `${Math.floor(diff / hour)}h`;
  return fmtDate(ts);
}

function fmtTpl(tpl: string, vars: Record<string, number | string>): string {
  return tpl.replace(/\{(\w+)\}/g, (_, k) => String(vars[k] ?? ''));
}

Page({
  data: {
    titleText: '',
    emptyText: '',
    notSignedIn: false,
    loginRequiredText: '',
    loginCta: '',
    rows: [] as ThreadRow[],
  },

  unsubscribe: undefined as (() => void) | undefined,
  asOwner: false,
  raw: [] as EnrichedMessageThread[],

  onLoad() {
    this.refreshStrings();
    this.unsubscribe = onLocaleChange(() => {
      this.refreshStrings();
      this.rebuildRows();
    });
  },

  async onShow() {
    if (!getOpenid()) {
      this.setData({ notSignedIn: true });
      return;
    }
    this.setData({ notSignedIn: false });
    await refreshCurrentUser();
    this.asOwner = isOwner();
    await this.load();
  },

  onUnload() {
    this.unsubscribe?.();
  },

  refreshStrings() {
    this.setData({
      titleText: t('messages_title'),
      emptyText: this.asOwner ? t('messages_owner_empty') : t('messages_empty'),
      loginRequiredText: t('booking_login_required'),
      loginCta: t('booking_required_login_cta'),
    });
  },

  async load() {
    this.raw = await messageThreadList({ scope: this.asOwner ? 'all' : 'mine' });
    this.rebuildRows();
  },

  rebuildRows() {
    const myOpenid = getOpenid();
    const rows: ThreadRow[] = this.raw.map((th) => {
      const serviceName = localized(th.serviceNameZh, th.serviceNameEn) || '—';
      const about = th.bookingDropoffAt
        ? fmtTpl(t('messages_thread_about'), {
            service: serviceName,
            from: fmtDate(th.bookingDropoffAt),
            to: fmtDate(th.bookingPickupAt),
          })
        : '';
      const title = this.asOwner
        ? fmtTpl(t('messages_thread_label_owner'), {
            who: th.parentNickname || (th.parentOpenid || '').slice(0, 8) + '…',
          })
        : t('messages_thread_label_parent');
      const unread = this.asOwner ? (th.unreadForOwner || 0) : th.parentOpenid === myOpenid ? (th.unreadForParent || 0) : 0;
      return {
        _id: th._id!,
        title,
        about,
        preview: th.lastMessagePreview || '',
        unread,
        timeStr: fmtRelative(th.lastMessageAt),
      };
    });
    this.setData({ rows });
  },

  goSignIn() {
    wx.switchTab({ url: '/pages/profile/profile' });
  },

  onRowTap(e: WechatMiniprogram.BaseEvent) {
    const id = (e.currentTarget.dataset as { id: string }).id;
    wx.navigateTo({ url: `/pages/messages/thread/thread?id=${id}` });
  },
});
