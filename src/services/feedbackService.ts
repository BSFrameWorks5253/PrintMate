export interface FeedbackItem {
  token: string; // e.g. "PM-74291"
  type: 'bug' | 'feature';
  title: string;
  description: string;
  email?: string;
  createdAt: string;
  status: 'pending' | 'in_progress' | 'solved' | 'added';
  adminNote?: string;
  resolvedAt?: string;
  viewedByReporter?: boolean;
}

const STORAGE_KEY = 'printmate_all_feedback';
const MY_TOKENS_KEY = 'printmate_my_tokens';

// Initial sample feedback if storage is empty
const INITIAL_FEEDBACK: FeedbackItem[] = [
  {
    token: 'PM-10248',
    type: 'feature',
    title: 'Offline PWA & Windows .EXE installer',
    description: 'Add direct 1-click download options for offline work.',
    email: 'user@example.com',
    createdAt: new Date(Date.now() - 86400000 * 2).toISOString(),
    status: 'added',
    adminNote: 'Shipped! PWA and Windows standalone setup .exe now available.',
    resolvedAt: new Date(Date.now() - 3600000 * 4).toISOString(),
    viewedByReporter: true,
  },
  {
    token: 'PM-20491',
    type: 'bug',
    title: 'Tone Setter slider thumb styling on high-DPI screens',
    description: 'Tone sliders were hard to grab and preview lagged.',
    email: 'studio@print.com',
    createdAt: new Date(Date.now() - 86400000).toISOString(),
    status: 'solved',
    adminNote: 'Resolved with high-contrast 20px thumbs and cached unwarp rendering.',
    resolvedAt: new Date().toISOString(),
    viewedByReporter: true,
  }
];

class FeedbackService {
  private getStorage(): FeedbackItem[] {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(INITIAL_FEEDBACK));
        return INITIAL_FEEDBACK;
      }
      return JSON.parse(raw);
    } catch {
      return INITIAL_FEEDBACK;
    }
  }

  private saveStorage(items: FeedbackItem[]): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
    } catch (e) {
      console.error('Failed to save feedback to localStorage', e);
    }
  }

  private getMyTokens(): string[] {
    try {
      const raw = localStorage.getItem(MY_TOKENS_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  }

  private saveMyTokens(tokens: string[]): void {
    try {
      localStorage.setItem(MY_TOKENS_KEY, JSON.stringify(tokens));
    } catch (e) {
      console.error('Failed to save my tokens', e);
    }
  }

  public getAll(): FeedbackItem[] {
    return this.getStorage();
  }

  public getByToken(token: string): FeedbackItem | null {
    const clean = token.trim().toUpperCase();
    return this.getStorage().find((item) => item.token.toUpperCase() === clean) || null;
  }

  public submit(data: {
    type: 'bug' | 'feature';
    title: string;
    description: string;
    email?: string;
  }): FeedbackItem {
    const items = this.getStorage();
    const token = `PM-${Math.floor(10000 + Math.random() * 90000)}`;

    const newItem: FeedbackItem = {
      token,
      type: data.type,
      title: data.title.trim(),
      description: data.description.trim(),
      email: data.email?.trim() || undefined,
      createdAt: new Date().toISOString(),
      status: 'pending',
      viewedByReporter: false,
    };

    items.unshift(newItem);
    this.saveStorage(items);

    // Save token to local device tracking
    const myTokens = this.getMyTokens();
    if (!myTokens.includes(token)) {
      myTokens.push(token);
      this.saveMyTokens(myTokens);
    }

    return newItem;
  }

  public updateStatus(
    token: string,
    status: 'pending' | 'in_progress' | 'solved' | 'added',
    adminNote?: string
  ): FeedbackItem | null {
    const items = this.getStorage();
    const index = items.findIndex((i) => i.token.toUpperCase() === token.trim().toUpperCase());
    if (index === -1) return null;

    const isResolved = status === 'solved' || status === 'added';

    items[index] = {
      ...items[index],
      status,
      adminNote: adminNote?.trim() || items[index].adminNote,
      resolvedAt: isResolved ? new Date().toISOString() : items[index].resolvedAt,
      viewedByReporter: false, // Reset so user receives active notification
    };

    this.saveStorage(items);
    return items[index];
  }

  public getMyUnreadResolvedTokens(): FeedbackItem[] {
    const myTokens = this.getMyTokens();
    if (myTokens.length === 0) return [];

    const all = this.getStorage();
    return all.filter((item) => 
      myTokens.includes(item.token) &&
      (item.status === 'solved' || item.status === 'added') &&
      !item.viewedByReporter
    );
  }

  public markAsViewed(token: string): void {
    const items = this.getStorage();
    const target = items.find((i) => i.token.toUpperCase() === token.trim().toUpperCase());
    if (target) {
      target.viewedByReporter = true;
      this.saveStorage(items);
    }
  }

  public getMySubmittedItems(): FeedbackItem[] {
    const myTokens = this.getMyTokens();
    if (myTokens.length === 0) return [];
    const all = this.getStorage();
    return all.filter((item) => myTokens.includes(item.token));
  }
}

export const feedbackService = new FeedbackService();

