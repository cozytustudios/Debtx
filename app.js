'use strict';

(function () {
    const STORAGE_KEY = 'debtx-data-v1';
    const LS_VERSION = 2;
    const ENV_DEFAULTS = {
        DEEPSEEK_MODEL: 'deepseek-chat',
        DEEPSEEK_BASE_URL: 'https://api.deepseek.com',
        DEEPSEEK_TIMEOUT_MS: 20000,
        DEEPSEEK_SYSTEM_PROMPT:
            'You are Debtx AI, a helpful assistant for Bangladeshi shopkeepers. ' +
            'Keep replies short, clear, and practical. If the user asks to change data, ' +
            'ask for missing details and confirm before saving.'
    };
    const DEEPSEEK_TOOL_INSTRUCTIONS = [
        'When the user asks to do something inside the app, respond with JSON only.',
        'Use this schema:',
        '{ "action": "add_task|add_debt|add_note|delete_task|delete_note|delete_customer|change_theme|create_bill|mark_bill_paid|record_payment|complete_task|open_panel|cancel_subscription", "data": { ... }, "reply": "optional user message" }',
        'For multiple actions use: { "actions": [ { ... }, { ... } ], "reply": "optional user message" }.',
        'Action data examples:',
        '- add_task: { "title": "task name", "date": "YYYY-MM-DD", "time": "HH:MM" }',
        '- add_debt: { "customerName": "name", "amount": 500, "note": "reason" }',
        '- delete_task: { "title": "task to delete" }',
        '- delete_note: { "title": "note to delete" }',
        '- record_payment: { "customerName": "name", "amount": 500 }',
        '- complete_task: { "title": "task to complete" }',
        '- change_theme: { "theme": "theme-name" }',
        '- mark_bill_paid: { "customerName": "name" } or { "invoiceNumber": "INV-001" }',
        '- open_panel: { "panel": "premium|customers|bills|ai|notes|settings" }',
        '- cancel_subscription: {} (no data needed)',
        'Dates must be YYYY-MM-DD and time must be HH:MM (24h).',
        'Themes: studio-pro, cozy-ledger, clean-business, night-shop, zen-finance, street-ledger, classic-paper, midnight-purple, sunset-orange.',
        'If details are missing, ask a short follow-up question instead of guessing.',
        'If the user is only asking a question, respond normally (no JSON).'
    ].join('\n');
    const MAX_DEEPSEEK_HISTORY = 12;

    if (typeof window !== 'undefined' && !window.__DEBTX_ENV) {
        window.__DEBTX_ENV = {};
    }

    function getEnvConfig() {
        const env = typeof window !== 'undefined' ? window.__DEBTX_ENV : null;
        return env && typeof env === 'object' ? env : {};
    }

    function getDeepSeekConfig() {
        const env = getEnvConfig();
        const apiKey = (env.DEEPSEEK_API_KEY || '').toString().trim();
        const model = (env.DEEPSEEK_MODEL || ENV_DEFAULTS.DEEPSEEK_MODEL).toString().trim();
        const baseUrl = (env.DEEPSEEK_BASE_URL || ENV_DEFAULTS.DEEPSEEK_BASE_URL).toString().trim();
        const timeoutMs = Number(env.DEEPSEEK_TIMEOUT_MS) || ENV_DEFAULTS.DEEPSEEK_TIMEOUT_MS;
        const systemPrompt = buildDeepSeekSystemPrompt(env.DEEPSEEK_SYSTEM_PROMPT || ENV_DEFAULTS.DEEPSEEK_SYSTEM_PROMPT);
        return {
            apiKey,
            model,
            baseUrl,
            timeoutMs: Math.max(5000, timeoutMs),
            systemPrompt
        };
    }

    function normalizeBaseUrl(baseUrl) {
        if (!baseUrl) return ENV_DEFAULTS.DEEPSEEK_BASE_URL;
        return baseUrl.replace(/\/+$/, '');
    }

    function buildDeepSeekChatUrl(baseUrl) {
        const normalized = normalizeBaseUrl(baseUrl);
        if (normalized.endsWith('/chat/completions')) {
            return normalized;
        }
        return `${normalized}/chat/completions`;
    }

    function hasDeepSeekKey() {
        return Boolean(getDeepSeekConfig().apiKey);
    }

    function updateNoApiBadge() {
        const badge = document.querySelector('.ai-noapi-badge');
        if (!badge) return;
        badge.style.display = hasDeepSeekKey() ? 'none' : 'inline-flex';
    }

    function appendChatHistory(role, content) {
        if (!content) return;
        if (!state.ai.chatHistory || !Array.isArray(state.ai.chatHistory)) {
            state.ai.chatHistory = [];
        }
        state.ai.chatHistory.push({ role, content: String(content) });
        if (state.ai.chatHistory.length > MAX_DEEPSEEK_HISTORY * 2) {
            state.ai.chatHistory = state.ai.chatHistory.slice(-MAX_DEEPSEEK_HISTORY * 2);
        }
    }

    function buildDeepSeekMessages(userMessage, systemPrompt) {
        const messages = [];
        if (systemPrompt) {
            messages.push({ role: 'system', content: systemPrompt });
        }
        const history = Array.isArray(state.ai.chatHistory) ? state.ai.chatHistory : [];
        history.slice(-MAX_DEEPSEEK_HISTORY * 2).forEach(msg => {
            if (!msg || !msg.role || !msg.content) return;
            messages.push({ role: msg.role, content: String(msg.content) });
        });
        messages.push({ role: 'user', content: String(userMessage) });
        return messages;
    }

    function buildDeepSeekMessagesWithHistory(userMessage, systemPrompt, history) {
        const messages = [];
        if (systemPrompt) {
            messages.push({ role: 'system', content: systemPrompt });
        }
        const safeHistory = Array.isArray(history) ? history : [];
        safeHistory.slice(-MAX_DEEPSEEK_HISTORY * 2).forEach(msg => {
            if (!msg || !msg.role || !msg.content) return;
            messages.push({ role: msg.role, content: String(msg.content) });
        });
        messages.push({ role: 'user', content: String(userMessage) });
        return messages;
    }

    function buildDeepSeekSystemPrompt(basePrompt) {
        const base = (basePrompt || ENV_DEFAULTS.DEEPSEEK_SYSTEM_PROMPT).toString().trim();
        if (!base) return DEEPSEEK_TOOL_INSTRUCTIONS;
        if (base.includes('respond with JSON only') || (base.includes('action') && base.includes('open_panel'))) {
            return base;
        }
        return `${base}\n\n${DEEPSEEK_TOOL_INSTRUCTIONS}`;
    }

    const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

    const todayString = () => {
        const now = new Date();
        const year = now.getFullYear();
        const month = String(now.getMonth() + 1).padStart(2, '0');
        const day = String(now.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    };

    const defaultState = () => ({
        version: LS_VERSION,
        language: 'bn',
        notificationsEnabled: false,
        customers: [],
        notes: [],
        tasks: [],
        bills: [],
        shopLogos: [],
        shop: {
            ownerName: '',
            shopName: '',
            shopLogo: '',
            ownerPhoto: '',
            phoneNumber: '',
            paymentNumber: '',
            paymentOption: 'bkash',
            paymentMethods: {
                bkash: { enabled: false, number: '' },
                nagad: { enabled: false, number: '' },
                rocket: { enabled: false, number: '' }
            }
        },
        auth: {
            name: '',
            email: '',
            profilePicture: '',
            extraPhoto: '',
            passwordHash: '',
            passcodeHash: '',
            createdAt: null,
            isGuest: true
        },
        session: {
            unlocked: true
        },
        ui: {
            selectedDate: todayString(),
            activePanel: 'premium',
            notesQuery: '',
            notesFilter: 'all',
            notesColorFilter: null, // Array of selected colors or null
            activeNotesTab: 'notes', // notes or tasks
            customersTab: 'customers', // customers or debts
            debtQuery: '',
            debtFilter: 'all',
            dockScale: 1,
            uiScale: 1,
            viewMode: 'phone',
            theme: 'studio-pro', // Default theme - premium and crisp
            haptics: true,
            sounds: true,
            textSize: 3,
            simpleTodo: false,
            pricingBilling: 'annual',
            hasSeenOnboarding: false
        },
        ai: {
            lastSummary: '',
            chatHistory: [],
            usageCount: 0,
            lastUsageDate: null,
            lastUsageKey: null,
            lastUsagePlan: null,
            pendingIntent: null,
            buddyName: 'Assistant', // Default AI buddy name
            proChatHistory: [],
            proChatUsageCount: 0,
            proChatUsageKey: null,
            proChatUsagePlan: null,
            proChatUsageDate: null
        },
        calculator: {
            expression: '',
            result: '0'
        },
        subscription: {
            plan: 'free', // free, max, ultra
            activatedAt: null,
            expiresAt: null
        }
    });

    const translations = {
        en: {
            'nav.home': 'Home',
            'nav.customers': 'Customers',
            'nav.debts': 'Baki',
            'nav.bills': 'Bills',
            'nav.ai': 'AI Agent',
            'nav.notesTasks': 'Notes & Tasks',
            'nav.notes': 'Notes',
            'nav.tasks': 'Tasks',
            'nav.settings': 'Settings',
            'nav.premium': 'Home',
            'ai.title': 'AI Agent',
            'ai.subtitle': 'Calm Bangla assistant for debt, tasks, and notes',
            'ai.greetingQuestion': 'How can I help you today?',
            'ai.usagePlanLabel': 'Plan',
            'ai.usageLabel': 'AI usage',
            'ai.noApiBadge': 'No API',
            'ai.cardGenerator': 'Card Generator',
            'ai.calculator': 'Calculator',
            'ai.chat': 'AI Agent',
            'ai.cardBadge': 'Studio',
            'ai.debtCardTitle': 'Debt Card Generator',
            'ai.debtCardHint': 'Build polished reminder cards with live preview and pro templates.',
            'ai.cardGenPillAuto': 'Auto-fill',
            'ai.cardGenPillPreview': 'Live Preview',
            'ai.cardGenPillShare': 'Share Ready',
            'ai.cardSectionCustomer': 'Customer Details',
            'ai.cardSectionPayment': 'Shop & Payment',
            'ai.cardSectionStyle': 'Style & Message',
            'ai.selectCustomer': 'Select Customer',
            'ai.selectLogo': 'Select Shop Logo',
            'ai.customerNameField': 'Customer Name (or enter manually)',
            'ai.customerName': 'Customer',
            'ai.debtAmount': 'Debt Amount (৳)',
            'ai.shopName': 'Shop Name',
            'ai.paymentMethod': 'Payment Method',
            'ai.paymentNumber': 'Payment Number/Details',
            'ai.dueDate': 'Due Date',
            'ai.cardStyle': 'Card Style',
            'ai.styleClassic': 'Classic',
            'ai.styleModern': 'Modern',
            'ai.styleMinimal': 'Minimal',
            'ai.reminderBadge': 'Payment Reminder',
            'ai.reminderTagline': 'Please settle the balance by the due date.',
            'ai.cardColor': 'Card Color',
            'ai.customMessage': 'Custom Message (optional)',
            'ai.generateCard': 'Generate Card',
            'ai.preview': 'Preview',
            'ai.downloadCard': '📥 Download',
            'ai.downloadPng': 'Download PNG',
            'ai.downloadPdf': 'Download PDF',
            'ai.shareCard': '📤 Share',
            'calculator.title': 'Calculator',
            'calculator.subtitle': 'Quick calculations for your shop',
            'customers.title': 'Customers & Debts',
            'customers.subtitle': 'Manage customer accounts and track payments',
            'customers.addCustomer': '+ Add Customer',
            'customers.searchPlaceholder': 'Search by name or phone',
            'customers.tabs.customers': 'Customers',
            'customers.tabs.debts': 'Debts',
            'customers.empty': 'No customers yet. Add your first customer to get started.',
            'customers.emptySearch': 'No customers found. Try a different search term.',
            'customers.card.balance': 'Outstanding Balance',
            'customers.card.lastPayment': 'Last Payment',
            'customers.card.dueDate': 'Due Date',
            'customers.card.trustRatio': 'Payment Reliability',
            'customers.card.history': 'View History',
            'customers.card.payment': 'Record Payment',
            'customers.card.demand': 'Request Payment',
            'customers.card.debt': 'Add New Debt',
            'customers.card.delete': 'Delete',
            'customers.card.historyTitle': 'Transaction History',
            'customers.card.settled': 'All Paid',
            'customers.card.onTrack': 'On Schedule',
            'customers.card.dueSoon': 'Due Soon',
            'customers.card.overdue': 'Overdue',
            'aiDebtCalendar.title': 'AI Debt Calendar',
            'aiDebtCalendar.subtitle': 'Upcoming payment days from your customers',
            'aiDebtCalendar.empty': 'No upcoming debt payments yet.',
            'aiDebtCalendar.refresh': 'Refresh',
            'settings.dockSizeTitle': 'Dock Custom',
            'settings.dockSizeHint': 'Customize dock size from really small to normal',
            'settings.dockCustomTitle': 'Dock Custom',
            'settings.dockCustomHint': 'Customize dock size from really small to normal',
            'debts.title': 'Debt Ledger',
            'debts.subtitle': 'Track every due amount across customers',
            'debts.searchPlaceholder': 'Search by customer or note',
            'debts.filterAll': 'All',
            'debts.filterOpen': 'Open',
            'debts.filterDueSoon': 'Due Soon',
            'debts.filterOverdue': 'Overdue',
            'debts.filterSettled': 'Settled',
            'debts.totalOutstanding': 'Total Outstanding',
            'debts.totalDueSoon': 'Due Soon',
            'debts.totalOverdue': 'Overdue',
            'debts.totalSettled': 'Settled',
            'debts.empty': 'No debts found. Add a customer or record a new debt.',
            'debts.card.outstanding': 'Outstanding',
            'debts.card.original': 'Original',
            'debts.card.paid': 'Paid',
            'debts.card.dueDate': 'Due',
            'debts.card.paysOn': 'Pays on',
            'debts.card.recordPayment': 'Record Payment',
            'debts.card.demandPayment': 'Request Payment',
            'debts.card.addDebt': 'Add Debt',
            'notes.title': 'Notes',
            'notes.subtitle': 'Capture ideas, payment reminders, and follow-ups',
            'notesTasks.title': 'Notes & Tasks',
            'notesTasks.subtitle': 'Keep notes and track your tasks in one place',
            'notes.addNote': '+ New Note',
            'notes.searchPlaceholder': 'Search titles or keywords...',
            'notes.filterAll': 'All',
            'notes.filterPinned': 'Pinned',
            'notes.filterRecent': 'Recent',
            'notes.filterYellow': 'Yellow',
            'notes.filterGreen': 'Green',
            'notes.filterBlue': 'Blue',
            'notes.filterPink': 'Pink',
            'notes.filterGray': 'Gray',
            'notes.empty': 'No notes yet. Add your first note to start capturing ideas.',
            'notes.pin': 'Pin to top',
            'notes.unpin': 'Unpin',
            'notes.deleteConfirm': 'Are you sure you want to delete this note?',
            'settings.title': 'Settings',
            'settings.subtitle': 'Customize your experience',
            'settings.profileTitle': 'Your Profile',
            'settings.editProfile': 'Edit Profile',
            'settings.themeTitle': 'Theme & Appearance',
            'settings.securityTitle': 'Security & Privacy',
            'settings.securityHint': 'Protect your shop data with a password',
            'settings.lockNow': 'Lock App Now',
            'settings.feedbackTitle': 'Haptics & Sounds',
            'settings.haptics': 'Enable Haptic Feedback',
            'settings.sounds': 'Enable Sound Effects',
            'settings.aiTitle': 'AI Assistant',
            'settings.aiHint': 'Get smart insights about your business',
            'settings.aiRefresh': 'Refresh Summary',
            'settings.aiEmpty': 'Tap refresh to see your business summary',
            'settings.languageTitle': 'Language',
            'settings.languageHint': 'Choose your preferred language',
            'settings.textSizeTitle': 'Text Size',
            'settings.textSizeHint': 'Make text bigger or smaller',
            'settings.shopProfileTitle': 'Shop Information',
            'settings.shopProfileHint': 'Manage your shop details and contact information',
            'settings.editShopProfile': 'Edit Shop Details',
            'settings.personalInfoTitle': 'Personal Information',
            'settings.phoneNumber': 'Phone Number',
            'settings.myPhoto': 'Your Photo',
            'settings.tapToUploadPhoto': 'Tap to Upload Photo',
            'settings.paymentInfoTitle': 'Payment Information',
            'settings.paymentNumber': 'Payment Number',
            'settings.paymentOption': 'Payment Method',
            'settings.monthlyWrapTitle': 'Monthly Summary',
            'settings.monthlyWrapHint': 'View your monthly business performance',
            'settings.paymentSettingsTitle': 'Payment Methods',
            'settings.paymentSettingsHint': 'Enable payment options for your customers',
            'settings.paymentMethodDesc': 'Mobile Banking',
            'settings.themeHint': 'Choose a theme that matches your style',
            'settings.monthlyWrapHint': 'Overview of your monthly activity',
            'settings.pendingAmount': 'Pending Payments',
            'settings.overallPerformance': 'Overall Performance',
            'themes.studioPro': 'Studio Pro',
            'themes.light': 'Light',
            'themes.dark': 'Dark',
            'themes.ocean': 'Ocean',
            'themes.rose': 'Rose',
            'themes.cozyLedger': 'Cozy Ledger',
            'themes.cleanBusiness': 'Clean Business',
            'themes.nightShop': 'Night Shop',
            'themes.zenFinance': 'Zen Finance',
            'themes.streetLedger': 'Street Ledger',
            'themes.classicPaper': 'Classic Paper',
            'settings.viewMonthlyWrap': 'View Full Monthly Report',
            'settings.totalRevenue': 'Total Revenue',
            'settings.paymentsReceived': 'Payments Received',
            'settings.billsGenerated': 'Bills Created',
            'settings.activeCustomers': 'Active Customers',
            'settings.shopLogosTitle': 'Shop Logos',
            'settings.shopLogosHint': 'Manage your shop logos',
            'settings.addLogo': '+ Add Logo',
            'settings.otherSettingsTitle': 'Other Settings',
            'settings.credits': 'Made by Cozytustudios\nFounder: Sajid Hossain',
            'settings.dataTitle': 'Data Backup & Transfer',
            'settings.dataHint': 'Export your data as JSON to backup or transfer to another device. Import to restore your data.',
            'settings.exportData': '📤 Export JSON',
            'settings.importData': '📥 Import JSON',
            'settings.exportSuccess': 'Data exported successfully',
            'settings.exportError': 'Export failed. Please try again',
            'settings.importSuccess': 'Data imported successfully',
            'settings.importError': 'Import failed. Please check the file format',
            'settings.themeImported': 'Theme imported successfully',
            'settings.themeImportError': 'Failed to import theme. Please check the file format',
            'settings.shopName': 'Shop Name',
            'settings.ownerName': 'Owner Name',
            'settings.couponPlaceholder': 'Enter coupon code (optional)',
            'settings.couponValid': 'Coupon valid!',
            'settings.couponInvalid': 'Invalid coupon',
            'settings.redeemCoupon': 'Redeem',
            'settings.readMore': 'Read More',
            'settings.account': 'Account',
            'settings.myAddress': 'My Address',
            'settings.notifications': 'Notifications',
            'language.english': 'English',
            'language.bengali': 'বাংলা',
            'modals.logo.title': 'Add Shop Logo',
            'modals.logo.name': 'Logo Name',
            'modals.logo.image': 'Logo Image',
            'themes.mint': 'Mint',
            'themes.midnight': 'Midnight',
            'themes.sunset': 'Sunset',
            'themes.rose': 'Rose',
            'themes.slate': 'Slate',
            'themes.ocean': 'Ocean',
            'themes.forest': 'Forest',
            'themes.neon': 'Neon',
            'themes.graphite': 'Graphite',
            'tasks.title': 'To-Do & Reminders',
            'tasks.subtitle': 'Watch payment dates and shop work',
            'tasks.addTask': '+ Add Task',
            'tasks.calendarHint': 'Tap a date to see upcoming payments and tasks',
            'tasks.empty': 'No tasks scheduled. Add your first task to get started.',
            'tasks.card.done': 'Mark as Done',
            'tasks.card.due': 'Due Date',
            'tasks.card.debtType': 'Customer Payment',
            'tasks.card.debtNote': 'Outstanding Balance',
            'tasks.card.completed': 'Completed',
            'actions.cancel': 'Cancel',
            'actions.save': 'Save',
            'actions.edit': 'Edit',
            'actions.delete': 'Delete',
            'auth.title': 'Secure Your Shop Records',
            'auth.subtitle': 'Set a password to protect your data. You can also add a quick passcode for faster access.',
            'auth.loginTab': 'Login',
            'auth.setupTab': 'Create account',
            'auth.passwordLabel': 'Password',
            'auth.passcodeLabel': 'Passcode (optional)',
            'auth.loginHint': 'Enter your password or passcode to unlock Debtx.',
            'auth.unlock': 'Unlock',
            'auth.nameLabel': 'Full name',
            'auth.emailLabel': 'Email',
            'auth.passwordCreateLabel': 'Create password',
            'auth.passcodeOptional': '4-8 digit passcode (optional)',
            'auth.profilePicture': 'Profile picture',
            'auth.extraPhoto': 'Additional photo',
            'auth.previewProfile': 'Profile',
            'auth.previewExtra': 'Photo',
            'auth.setupHint': 'You will need this password each time you open Debtx.',
            'auth.create': 'Save & Unlock',
            'auth.getStarted': 'Get Started',
            'auth.skip': 'Skip for now →',
            'auth.skipHint': 'Use without password protection',
            'auth.tapToUpload': 'Tap to add photo',
            'auth.advancedSecurity': '🔒 Add password protection (optional)',
            'auth.lock': 'Lock',
            'auth.errorInvalid': 'Incorrect password or passcode. Try again.',
            'auth.errorPasswordShort': 'Password must be at least 6 characters',
            'modals.customer.title': 'Add Customer',
            'modals.customer.name': 'Customer Name',
            'modals.customer.phone': 'Phone Number (optional)',
            'modals.customer.repayDays': 'Repayment window (days)',
            'modals.customer.note': 'Note',
            'modals.debt.title': 'Record Debt',
            'modals.debt.customer': 'Customer',
            'modals.debt.customerPlaceholder': 'Select customer',
            'modals.debt.amount': 'Debt Amount (৳)',
            'modals.debt.description': 'Description',
            'modals.debt.date': 'Date',
            'modals.payment.title': 'Record Payment',
            'modals.payment.amount': 'Payment Amount (৳)',
            'modals.payment.date': 'Date',
            'modals.payment.note': 'Note',
            'modals.note.title': 'New Note',
            'modals.note.titleLabel': 'Title',
            'modals.note.color': 'Color',
            'modals.note.colorYellow': 'Yellow',
            'modals.note.colorGreen': 'Green',
            'modals.note.colorBlue': 'Blue',
            'modals.note.colorPink': 'Pink',
            'modals.note.colorGray': 'Gray',
            'modals.note.body': 'Note',
            'modals.note.pinned': 'Pin to top',
            'modals.task.title': 'Add Task',
            'modals.task.name': 'Task Name',
            'modals.task.type': 'Type',
            'modals.task.typePayment': 'Payment Follow-up',
            'modals.task.typeDelivery': 'Delivery',
            'modals.task.typePurchase': 'Stock Purchase',
            'modals.task.typeOther': 'Other',
            'modals.task.date': 'Due Date',
            'modals.task.time': 'Due Time (optional)',
            'modals.task.note': 'Note',
            'modals.task.priority': 'Priority',
            'modals.task.recurring': 'Repeat this task',
            'modals.task.recurringType': 'Repeat',
            'modals.task.typeWork': 'Work',
            'modals.task.typePersonal': 'Personal',
            'modals.task.typeShopping': 'Shopping',
            'modals.profile.title': 'Edit Profile',
            'modals.profile.name': 'Name',
            'modals.profile.email': 'Email',
            'modals.profile.profilePicture': 'Profile picture',
            'modals.profile.extraPhoto': 'Additional photo',
            'modals.demand.title': 'Demand Payment',
            'modals.demand.amount': 'Amount to request (৳)',
            'modals.demand.dueDate': 'Due date',
            'modals.demand.method': 'Payment method / link',
            'modals.demand.note': 'Message',
            'modals.demand.generate': 'Generate card',
            'modals.demand.share': 'Share',
            'modals.demand.download': 'Download',
            'modals.demand.previewText': 'Generated payment card will appear here',
            'modals.shopProfile.title': 'Shop Profile',
            'modals.shopProfile.ownerName': 'Your Name',
            'modals.shopProfile.shopName': 'Shop Name',
            'modals.shopProfile.phoneNumber': 'Phone Number',
            'modals.shopProfile.shopLogo': 'Shop Logo/Picture',
            'modals.shopProfile.yourPhoto': 'Your Photo',
            'modals.shopProfile.paymentMethods': 'Payment Methods',
            'modals.shopProfile.bkashNumber': 'bKash Number',
            'modals.shopProfile.nagadNumber': 'Nagad Number',
            'modals.shopProfile.rocketNumber': 'Rocket Number',
            'bills.title': 'Billing & Invoicing',
            'bills.subtitle': 'Create bills, invoices, and track payments',
            'bills.newBill': '+ New Bill',
            'bills.searchPlaceholder': 'Search bills by customer, invoice number...',
            'bills.filterAll': 'All',
            'bills.filterPaid': 'Paid',
            'bills.filterPending': 'Pending',
            'bills.filterOverdue': 'Overdue',
            'bills.empty': 'No bills yet. Create your first bill.',
            'bills.duplicate': 'Duplicate',
            'bills.view': 'View',
            'bills.share': 'Share',
            'bills.downloadPng': 'Download PNG',
            'bills.downloadPdf': 'Download PDF',
            'bills.makeInvoice': 'Make Invoice',
            'bills.invoiceNumber': 'Invoice #',
            'bills.items': 'Items',
            'bills.totalAmount': 'Total',
            'bills.status': 'Status',
            'bills.dueDate': 'Due Date',
            'bills.date': 'Date',
            'bills.totalBills': 'Total Bills',
            'bills.paidBills': 'Paid',
            'bills.pendingBills': 'Pending',
            'bills.overdueBills': 'Overdue',
            'modals.bill.title': 'Create Bill / Invoice',
            'modals.bill.subtitle': 'Generate professional bills for your customers',
            'modals.bill.customerName': 'Customer Name',
            'modals.bill.customerNameManual': 'Or Enter Customer Name',
            'modals.bill.invoiceNumber': 'Invoice Number (Auto-generated if empty)',
            'modals.bill.productsTitle': 'Items / Services',
            'modals.bill.addProduct': 'Add Item',
            'modals.bill.subtotal': 'Subtotal',
            'modals.bill.discount': 'Discount (%)',
            'modals.bill.tax': 'Tax (%) (Optional)',
            'modals.bill.total': 'Total Amount',
            'modals.bill.dueDate': 'Due Date',
            'modals.bill.paymentStatus': 'Payment Status',
            'modals.bill.statusPending': 'Pending',
            'modals.bill.statusPaid': 'Paid',
            'modals.bill.statusPartial': 'Partial',
            'modals.bill.notes': 'Notes / Terms (Optional)',
            'modals.bill.generateBill': 'Generate Bill',
            'modals.billCustomize.title': 'Customize Bill Card',
            'modals.billCustomize.theme': 'Theme',
            'modals.billCustomize.themeMinimal': 'Minimal',
            'modals.billCustomize.themeCozy': 'Cozy',
            'modals.billCustomize.themeProfessional': 'Professional',
            'modals.billCustomize.layout': 'Layout Style',
            'modals.billCustomize.colors': 'Colors',
            'modals.billCustomize.font': 'Font',
            'modals.billCustomize.spacing': 'Spacing',
            'modals.billCustomize.border': 'Border',
            'modals.billCustomize.logo': 'Shop Logo',
            'modals.billCustomize.fontSize': 'Font Size',
            'modals.billCustomize.icons': 'Icons',
            'modals.billCustomize.customNotes': 'Custom Notes',
            'modals.billCustomize.sections': 'Section Order',
            'modals.billCustomize.preview': 'Live Preview',
            'modals.billCustomize.reset': 'Reset',
            'modals.billCustomize.apply': 'Apply & Download',
            'modals.monthlyWrap.title': 'Monthly Summary',
            'modals.monthlyWrap.loading': 'Loading monthly summary...',
            'modals.cardCustomize.title': 'Customize Card',
            'modals.cardCustomize.style': 'Card Style',
            'modals.cardCustomize.message': 'Custom Message',
            'modals.cardCustomize.emoji': 'Add Emoji',
            'actions.close': 'Close',
            'actions.apply': 'Apply',
            'footer.text': 'Debtx keeps your khata simple, clear, and close to you.',
            'ai.title': 'AI Agent',
            'ai.subtitle': 'Calm Bangla assistant for debt, tasks, and notes',
            'ai.welcome': 'Hi! I can help with debts, tasks, notes, and calm summaries. Speak in Bangla or English, and I will confirm before saving.',
            'ai.placeholder': 'Type or speak in Bangla or English...',
            'ai.agentBadge': 'AI Agent',
            'ai.agentTitle': 'Calm, Bangla-first assistant',
            'ai.agentHint': 'Speak in Bangla to add debt, tasks, or notes. Everything stays local.',
            'ai.shortcut.summary': 'Summarize tasks',
            'ai.shortcut.addTask': 'Add task',
            'ai.shortcut.addNote': 'Add note',
            'ai.shortcut.addDebt': 'Add debt',
            'ai.shortcut.theme': 'Change theme',
            'ai.limitTitleFree': 'Your free AI limit is finished for today',
            'ai.limitBodyFree': 'Upgrade to Max to use the Agent more.',
            'ai.limitTitleMax': 'Your Max cycle limit is finished',
            'ai.limitBodyMax': 'Upgrade to Ultra for unlimited AI support anytime.',
            'ai.limitCta': 'See plans',
            'ai.paywallLater': 'Not now',
            'ai.paywallCta': 'See Max plan',
            'pricing.kicker': 'Simple, calm pricing',
            'pricing.title': 'Clear AI access from day one',
            'pricing.subtitle': 'See how much AI you can use, where voice lives, and what the Agent can do.',
            'pricing.currentLabel': 'Current plan',
            'pricing.aiUsageLabel': 'AI usage',
            'pricing.perMonth': '/month',
            'pricing.perYear': '/year',
            'pricing.freePeriod': 'Forever',
            'pricing.maxTagline': 'For growing shops that want more AI help.',
            'pricing.ultraTagline': 'Unlimited AI for busy, calm days.',
            'pricing.freeTagline': 'Start with core debts, tasks, and basic voice.',
            'pricing.usagePreviewLabel': 'AI usage preview',
            'pricing.usagePreviewFree': '0/30 today',
            'pricing.usagePreviewMax': '12/100 this month',
            'pricing.usagePreviewUltra': 'Unlimited',
            'pricing.couponPlaceholder': 'Enter coupon code',
            'pricing.free.feature1': 'Basic Baki + Tasks',
            'pricing.free.feature2': 'AI Agent: 30/day',
            'pricing.free.feature3': 'Basic voice input (limited commands)',
            'pricing.max.feature1': 'AI Agent: 100 / billing cycle',
            'pricing.max.feature2': 'Agent button fully enabled in Docs',
            'pricing.max.feature3': 'Theme change, automation & controls',
            'pricing.ultra.feature1': 'Unlimited AI Agent',
            'pricing.ultra.feature2': 'All features unlocked',
            'pricing.ultra.feature3': 'Priority automation & controls',
            'pricing.footnote': 'No paid APIs. Works offline and keeps your data close.',
            'home.quick.customers': 'Open customers',
            'home.quick.bills': 'Bills & invoices',
            'home.quick.settings': 'Settings',
            'docs.title': 'Voice + No API Guide',
            'docs.subtitle': 'See exactly how Bangla-first voice and the agent work.',
            'docs.voice.title': 'Voice flow',
            'docs.voice.step1': 'Transcribe Bangla + English speech',
            'docs.voice.step2': 'Extract fields: name, amount, type, date, note, time',
            'docs.voice.step3': 'Auto-fill the form fields',
            'docs.voice.step4': 'Preview and confirm save',
            'docs.voice.where': 'Mic is always in Add Baki, Add Task, Quick Add, and the Agent.',
            'docs.noapi.title': 'No API Agent',
            'docs.noapi.body': 'Rule-based intent parser (keywords + regex + entity extraction). Optional on-device model can be added later.',
            'docs.examples.title': 'Natural Bangla examples',
            'voice.listening': 'Listening...',
            'voice.preview.title': 'Voice preview',
            'voice.preview.confirmQuestion': 'Confirm save?',
            'voice.preview.customer': 'Customer',
            'voice.preview.amount': 'Amount',
            'voice.preview.type': 'Type',
            'voice.preview.date': 'Date',
            'voice.preview.time': 'Time',
            'voice.preview.task': 'Task',
            'voice.preview.note': 'Note',
            'voice.preview.edit': 'Edit',
            'voice.preview.confirmCta': 'Confirm save',
            'ai.ultraOnly': 'Ultra Only',
            'ai.ultraExclusive': 'AI Chat - Ultra Exclusive',
            'notifications.enabled': 'Reminders on',
            'notifications.disabled': 'Reminders off',
            'notifications.permissionDenied': 'Notifications blocked. Please allow them from your browser settings.',
            'notifications.dueToday': 'Payment due today for',
            'notifications.dueTodayBody': 'Amount due today: {amount}',
            'notifications.overdue': 'Overdue payment for',
            'notifications.overdueBody': 'Still due: {amount}',
            'notifications.taskDue': 'Task due today:',
            'notifications.taskDueBody': '{task}',
            'calendar.monthNames': [
                'January', 'February', 'March', 'April', 'May', 'June',
                'July', 'August', 'September', 'October', 'November', 'December'
            ],
            'calendar.dayNames': ['S', 'M', 'T', 'W', 'T', 'F', 'S'],
            'calendar.empty': 'No items for this day Add a task or record a debt',
            'onboarding.welcome': 'Welcome to DebtX!',
            'onboarding.subtitle': 'Let us show you how to get started',
            'onboarding.skip': 'Skip Tutorial',
            'onboarding.next': 'Next',
            'onboarding.prev': 'Back',
            'onboarding.done': 'Get Started',
            'onboarding.step1.title': 'Add Your First Customer',
            'onboarding.step1.desc': 'Start by adding customers to track their debts and payments. Tap the + button on the Customers page.',
            'onboarding.step2.title': 'Record Debts & Payments',
            'onboarding.step2.desc': 'After adding a customer, you can record debts when they buy on credit and payments when they pay back.',
            'onboarding.step3.title': 'Create Professional Bills',
            'onboarding.step3.desc': 'Go to Bills section to create beautiful, professional bills. Add items, set prices, and generate printable bills.',
            'onboarding.step4.title': 'You\'re All Set!',
            'onboarding.step4.desc': 'Explore Notes for quick reminders, AI Tools for smart features, and Settings to customize your experience.'
        },
        bn: {
            'nav.home': 'হোম',
            'nav.customers': 'ক্রেতা',
            'nav.debts': 'বাকি',
            'nav.bills': 'বিল',
            'nav.ai': 'এআই এজেন্ট',
            'nav.notesTasks': 'নোট ও কাজ',
            'nav.notes': 'নোট',
            'nav.tasks': 'কাজ',
            'nav.settings': 'সেটিংস',
            'nav.premium': 'হোম',
            'ai.title': 'এআই এজেন্ট',
            'ai.subtitle': 'দেনা, কাজ ও নোটের জন্য শান্ত বাংলা সহায়ক',
            'ai.greetingQuestion': 'আজ আপনাকে কীভাবে সাহায্য করতে পারি?',
            'ai.usagePlanLabel': 'প্ল্যান',
            'ai.usageLabel': 'এআই ব্যবহার',
            'ai.noApiBadge': 'No API',
            'ai.cardGenerator': 'কার্ড জেনারেটর',
            'ai.calculator': 'ক্যালকুলেটর',
            'ai.chat': 'এআই এজেন্ট',
            'ai.cardBadge': 'স্টুডিও',
            'ai.debtCardTitle': 'ঋণ কার্ড জেনারেটর',
            'ai.debtCardHint': 'লাইভ প্রিভিউ ও প্রো টেমপ্লেট দিয়ে সুন্দর কার্ড তৈরি করুন।',
            'ai.cardGenPillAuto': 'অটো-ফিল',
            'ai.cardGenPillPreview': 'লাইভ প্রিভিউ',
            'ai.cardGenPillShare': 'শেয়ার রেডি',
            'ai.cardSectionCustomer': 'ক্রেতার তথ্য',
            'ai.cardSectionPayment': 'দোকান ও পেমেন্ট',
            'ai.cardSectionStyle': 'স্টাইল ও বার্তা',
            'ai.selectCustomer': 'ক্রেতা নির্বাচন করুন',
            'ai.selectLogo': 'দোকানের লোগো নির্বাচন করুন',
            'ai.customerNameField': 'ক্রেতার নাম (বা নিজে লিখুন)',
            'ai.customerName': 'ক্রেতা',
            'ai.debtAmount': 'ঋণের পরিমাণ (৳)',
            'ai.shopName': 'দোকানের নাম',
            'ai.paymentMethod': 'পেমেন্ট পদ্ধতি',
            'ai.paymentNumber': 'পেমেন্ট নম্বর/বিবরণ',
            'ai.dueDate': 'শেষ তারিখ',
            'ai.cardStyle': 'কার্ড স্টাইল',
            'ai.styleClassic': 'ক্লাসিক',
            'ai.styleModern': 'মডার্ন',
            'ai.styleMinimal': 'মিনিমাল',
            'ai.reminderBadge': 'পেমেন্ট রিমাইন্ডার',
            'ai.reminderTagline': 'দয়া করে শেষ তারিখের মধ্যে বাকি পরিশোধ করুন।',
            'ai.cardColor': 'কার্ডের রঙ',
            'ai.customMessage': 'কাস্টম বার্তা (ঐচ্ছিক)',
            'ai.generateCard': 'কার্ড তৈরি করুন',
            'ai.preview': 'প্রিভিউ',
            'ai.downloadCard': '📥 ডাউনলোড',
            'ai.downloadPng': 'PNG ডাউনলোড',
            'ai.downloadPdf': 'PDF ডাউনলোড',
            'ai.shareCard': '📤 শেয়ার',
            'calculator.title': 'ক্যালকুলেটর',
            'calculator.subtitle': 'দ্রুত হিসাব করুন',
            'customers.title': 'ক্রেতা ও দেনা',
            'customers.subtitle': 'দেনা, পরিশোধ ও অনুস্মারক ট্র্যাক করুন',
            'customers.addCustomer': '+ নতুন ক্রেতা',
            'customers.searchPlaceholder': 'নাম বা ফোন দিয়ে খুঁজুন',
            'customers.tabs.customers': 'ক্রেতা',
            'customers.tabs.debts': 'দেনা',
            'customers.empty': 'এখনও কোনো ক্রেতা নেই প্রথম ক্রেতা যুক্ত করুন',
            'customers.emptySearch': 'কোনো ক্রেতা পাওয়া যায়নি অন্যভাবে খুঁজুন',
            'customers.card.balance': 'বাকি টাকা',
            'customers.card.lastPayment': 'সর্বশেষ পেমেন্ট',
            'customers.card.dueDate': 'পরিশোধের তারিখ',
            'customers.card.trustRatio': 'পেমেন্ট নির্ভরযোগ্যতা',
            'customers.card.history': 'ইতিহাস দেখুন',
            'customers.card.payment': 'পেমেন্ট নিন',
            'customers.card.demand': 'পেমেন্ট দাবি',
            'customers.card.debt': 'নতুন দেনা যোগ করুন',
            'customers.card.delete': 'মুছুন',
            'customers.card.historyTitle': 'লেনদেনের ইতিহাস',
            'customers.card.settled': 'সমস্ত পরিশোধিত',
            'customers.card.onTrack': 'সময়ের মধ্যে',
            'customers.card.dueSoon': 'শীঘ্রই বাকি',
            'customers.card.overdue': 'বাকি পড়েছে',
            'aiDebtCalendar.title': 'এআই দেনা ক্যালেন্ডার',
            'aiDebtCalendar.subtitle': 'ক্রেতাদের পরিশোধের তারিখ দেখুন',
            'aiDebtCalendar.empty': 'এখনও কোনো দেনার তারিখ নেই।',
            'aiDebtCalendar.refresh': 'রিফ্রেশ',
            'settings.dockSizeTitle': 'ডক কাস্টম',
            'settings.dockSizeHint': 'ডক সাইজ অনেক ছোট থেকে স্বাভাবিক পর্যন্ত কাস্টমাইজ করুন',
            'settings.dockCustomTitle': 'ডক কাস্টম',
            'settings.dockCustomHint': 'ডক সাইজ অনেক ছোট থেকে স্বাভাবিক পর্যন্ত কাস্টমাইজ করুন',
            'debts.title': 'দেনা খাতা',
            'debts.subtitle': 'সব ক্রেতার বকেয়া এক জায়গায় দেখুন',
            'debts.searchPlaceholder': 'ক্রেতা বা নোট দিয়ে খুঁজুন',
            'debts.filterAll': 'সব',
            'debts.filterOpen': 'চলমান',
            'debts.filterDueSoon': 'শীঘ্রই বাকি',
            'debts.filterOverdue': 'বাকি পড়েছে',
            'debts.filterSettled': 'পরিশোধিত',
            'debts.totalOutstanding': 'মোট বকেয়া',
            'debts.totalDueSoon': 'শীঘ্রই বাকি',
            'debts.totalOverdue': 'বাকি পড়েছে',
            'debts.totalSettled': 'পরিশোধিত',
            'debts.empty': 'কোনো দেনা পাওয়া যায়নি নতুন দেনা যোগ করুন।',
            'debts.card.outstanding': 'বকেয়া',
            'debts.card.original': 'মূল',
            'debts.card.paid': 'পরিশোধ',
            'debts.card.dueDate': 'পরিশোধের তারিখ',
            'debts.card.paysOn': 'পেমেন্টের তারিখ',
            'debts.card.recordPayment': 'পেমেন্ট নিন',
            'debts.card.demandPayment': 'পেমেন্ট দাবি',
            'debts.card.addDebt': 'নতুন দেনা যোগ করুন',
            'notes.title': 'নোট',
            'notes.subtitle': 'আইডিয়া, পেমেন্ট রিমাইন্ডার ও ফলো-আপ সংরক্ষণ করুন',
            'notesTasks.title': 'নোট ও কাজ',
            'notesTasks.subtitle': 'এক জায়গায় নোট রাখুন এবং কাজ ট্র্যাক করুন',
            'notes.addNote': '+ নতুন নোট',
            'notes.searchPlaceholder': 'শিরোনাম বা লেখা খুঁজুন...',
            'notes.filterAll': 'সব',
            'notes.filterPinned': 'পিন করা',
            'notes.filterRecent': 'সাম্প্রতিক',
            'notes.filterYellow': 'হলুদ',
            'notes.filterGreen': 'সবুজ',
            'notes.filterBlue': 'নীল',
            'notes.filterPink': 'গোলাপি',
            'notes.filterGray': 'ধূসর',
            'notes.empty': 'এখনও কোনো নোট নেই। আপনার প্রথম নোট তৈরি করুন।',
            'notes.pin': 'উপরে পিন করুন',
            'notes.unpin': 'আনপিন করুন',
            'notes.deleteConfirm': 'আপনি কি নিশ্চিত যে আপনি এই নোটটি মুছে ফেলতে চান?',
            'settings.title': 'সেটিংস',
            'settings.subtitle': 'থিম, প্রোফাইল ও নিরাপত্তা',
            'settings.profileTitle': 'প্রোফাইল',
            'settings.editProfile': 'এডিট',
            'settings.themeTitle': 'থিম',
            'settings.securityTitle': 'নিরাপত্তা',
            'settings.securityHint': 'Debtx খুললেই পাসওয়ার্ড লাগবে',
            'settings.lockNow': 'এখনই লক',
            'settings.feedbackTitle': 'হ্যাপটিক ও সাউন্ড',
            'settings.haptics': 'হ্যাপটিক চালু',
            'settings.sounds': 'সাউন্ড চালু',
            'settings.aiTitle': 'এআই সহায়ক',
            'settings.aiHint': 'অফলাইনে টাস্ক/ইতিহাসের সারাংশ দেখায় কোনো API লাগে না',
            'ai.ultraOnly': 'শুধু Ultra',
            'ai.ultraExclusive': 'এআই চ্যাট - Ultra একচেটিয়া',
            'settings.aiRefresh': 'সারাংশ দেখাও',
            'settings.aiEmpty': 'সারাংশ দেখতে বাটনে ট্যাপ করুন',
            'settings.languageTitle': 'ভাষা',
            'settings.textSizeTitle': 'লেখার আকার',
            'settings.textSizeHint': 'লেখা বড় বা ছোট করুন',
            'settings.languageHint': 'আপনার পছন্দের ভাষা নির্বাচন করুন',
            'settings.shopProfileTitle': 'দোকানের তথ্য',
            'settings.shopProfileHint': 'আপনার দোকানের বিবরণ এবং যোগাযোগের তথ্য পরিচালনা করুন',
            'settings.editShopProfile': 'এডিট',
            'settings.personalInfoTitle': 'ব্যক্তিগত তথ্য',
            'settings.phoneNumber': 'ফোন নম্বর',
            'settings.myPhoto': 'আমার ছবি',
            'settings.tapToUploadPhoto': 'আপলোড করতে ট্যাপ করুন',
            'settings.paymentInfoTitle': 'পেমেন্ট তথ্য',
            'settings.paymentNumber': 'পেমেন্ট নম্বর',
            'settings.paymentOption': 'পেমেন্ট অপশন',
            'settings.monthlyWrapTitle': 'মাসিক সারাংশ',
            'settings.monthlyWrapHint': 'আপনার মাসিক ব্যবসার সারাংশ এবং অন্তর্দৃষ্টি দেখুন',
            'settings.paymentSettingsTitle': 'পেমেন্ট সেটিংস',
            'settings.paymentSettingsHint': 'সমর্থিত পেমেন্ট বিকল্পগুলি সক্রিয় বা নিষ্ক্রিয় করুন',
            'settings.paymentMethodDesc': 'মোবাইল ব্যাঙ্কিং',
            'settings.themeHint': 'তাত্ক্ষণিক প্রিভিউ সহ থিমগুলির মধ্যে স্যুইচ করুন',
            'settings.monthlyWrapHint': 'আপনার মাসিক কার্যক্রমের ভিজ্যুয়াল সারাংশ',
            'settings.pendingAmount': 'বকেয়া পরিমাণ',
            'settings.overallPerformance': 'সামগ্রিক পারফরম্যান্স',
            'themes.studioPro': 'স্টুডিও প্রো',
            'themes.light': 'লাইট',
            'themes.dark': 'ডার্ক',
            'themes.ocean': 'ওশান',
            'themes.rose': 'রোজ',
            'themes.cozyLedger': 'আরামদায়ক খাতা',
            'themes.cleanBusiness': 'পরিষ্কার ব্যবসা',
            'themes.nightShop': 'রাতের দোকান',
            'themes.zenFinance': 'শান্ত আর্থিক',
            'themes.streetLedger': 'আধুনিক খাতা',
            'themes.classicPaper': 'ক্লাসিক কাগজ',
            'settings.viewMonthlyWrap': 'সম্পূর্ণ মাসিক র্যাপ দেখুন',
            'settings.totalRevenue': 'মোট আয়',
            'settings.paymentsReceived': 'পেমেন্ট প্রাপ্ত',
            'settings.billsGenerated': 'বিল তৈরি',
            'settings.activeCustomers': 'সক্রিয় ক্রেতা',
            'settings.shopLogosTitle': 'দোকানের লোগো',
            'settings.shopLogosHint': 'আপনার দোকানের লোগো পরিচালনা করুন',
            'settings.addLogo': '+ লোগো যোগ করুন',
            'settings.otherSettingsTitle': 'অন্যান্য সেটিংস',
            'settings.credits': 'তৈরি করেছেন কোজিটুস্টুডিওস প্রতিষ্ঠাতা সাজিদ হোসেন',
            'settings.dataTitle': 'ডেটা ব্যাকআপ ও ট্রান্সফার',
            'settings.dataHint': 'ব্যাকআপ বা অন্য ডিভাইসে ট্রান্সফারের জন্য JSON এক্সপোর্ট করুন ইমপোর্ট করে রিস্টোর করুন',
            'settings.exportData': '📤 এক্সপোর্ট JSON',
            'settings.importData': '📥 ইমপোর্ট JSON',
            'settings.exportSuccess': 'ডেটা সফলভাবে এক্সপোর্ট হয়েছে',
            'settings.exportError': 'এক্সপোর্ট ব্যর্থ আবার চেষ্টা করুন',
            'settings.importSuccess': 'ডেটা সফলভাবে ইমপোর্ট হয়েছে',
            'settings.importError': 'ইমপোর্ট ব্যর্থ ফাইল ফরম্যাট সঠিক নয়',
            'settings.shopName': 'দোকানের নাম',
            'settings.ownerName': 'মালিকের নাম',
            'settings.couponPlaceholder': 'কুপন কোড লিখুন (ঐচ্ছিক)',
            'settings.couponValid': 'কুপন বৈধ!',
            'settings.couponInvalid': 'অবৈধ কুপন',
            'settings.redeemCoupon': 'রিডিম করুন',
            'settings.readMore': 'আরও পড়ুন',
            'settings.account': 'অ্যাকাউন্ট',
            'settings.myAddress': 'আমার ঠিকানা',
            'settings.notifications': 'বিজ্ঞপ্তি',
            'language.english': 'English',
            'language.bengali': 'বাংলা',
            'modals.logo.title': 'দোকানের লোগো যোগ করুন',
            'modals.logo.name': 'লোগোর নাম',
            'modals.logo.image': 'লোগো ছবি',
            'themes.mint': 'মিন্ট',
            'themes.midnight': 'মিডনাইট',
            'themes.sunset': 'সানসেট',
            'themes.rose': 'রোজ',
            'themes.slate': 'স্লেট',
            'themes.ocean': 'ওশান',
            'themes.forest': 'ফরেস্ট',
            'themes.neon': 'নিয়ন',
            'themes.graphite': 'গ্রাফাইট',
            'tasks.title': 'করণীয় ও রিমাইন্ডার',
            'tasks.subtitle': 'পেমেন্ট তারিখ ও দোকানের কাজ দেখুন',
            'tasks.addTask': '+ নতুন কাজ',
            'tasks.calendarHint': 'দিনে ট্যাপ করুন দেখুন পেমেন্ট ও কাজ',
            'tasks.empty': 'এখনও কোনো কাজ নেই রিমাইন্ডার যোগ করুন',
            'tasks.card.done': 'শেষ',
            'tasks.card.due': 'শেষ করার তারিখ',
            'tasks.card.debtType': 'ক্রেতার পেমেন্ট',
            'tasks.card.debtNote': 'অবশিষ্ট টাকা',
            'tasks.card.completed': 'সম্পন্ন',
            'actions.cancel': 'বাতিল',
            'actions.save': 'সংরক্ষণ করুন',
            'actions.edit': 'সম্পাদনা',
            'actions.delete': 'মুছে ফেলুন',
            'auth.title': 'আপনার দোকানের ডেটা সুরক্ষিত রাখুন',
            'auth.subtitle': 'প্রতিবার ঢোকার সময় পাসওয়ার্ড লাগবে দ্রুত আনলকের জন্য পাসকোড দিন',
            'auth.loginTab': 'লগইন',
            'auth.setupTab': 'অ্যাকাউন্ট তৈরি',
            'auth.passwordLabel': 'পাসওয়ার্ড',
            'auth.passcodeLabel': 'পাসকোড (ঐচ্ছিক)',
            'auth.loginHint': 'পাসওয়ার্ড (বা সেট করা পাসকোড) লিখে Debtx আনলক করুন',
            'auth.unlock': 'আনলক',
            'auth.nameLabel': 'পুরো নাম',
            'auth.emailLabel': 'ইমেইল',
            'auth.passwordCreateLabel': 'পাসওয়ার্ড তৈরি করুন',
            'auth.passcodeOptional': '৪-৮ সংখ্যার পাসকোড (ঐচ্ছিক)',
            'auth.profilePicture': 'প্রোফাইল ছবি',
            'auth.extraPhoto': 'অতিরিক্ত ছবি',
            'auth.previewProfile': 'প্রোফাইল',
            'auth.previewExtra': 'ছবি',
            'auth.setupHint': 'প্রতিবার Debtx খুললেই এই পাসওয়ার্ড লাগবে',
            'auth.create': 'সংরক্ষণ ও আনলক',
            'auth.getStarted': 'শুরু করুন',
            'auth.skip': 'এড়িয়ে যান →',
            'auth.skipHint': 'পাসওয়ার্ড ছাড়া ব্যবহার করুন',
            'auth.tapToUpload': 'ছবি যোগ করতে ট্যাপ করুন',
            'auth.advancedSecurity': '🔒 পাসওয়ার্ড সুরক্ষা যোগ করুন (ঐচ্ছিক)',
            'auth.lock': 'লক',
            'auth.errorInvalid': 'পাসওয়ার্ড বা পাসকোড ভুল হয়েছে আবার চেষ্টা করুন',
            'auth.errorPasswordShort': 'পাসওয়ার্ড কমপক্ষে ৬ অক্ষরের হতে হবে',
            'modals.customer.title': 'ক্রেতা যোগ করুন',
            'modals.customer.name': 'ক্রেতার নাম',
            'modals.customer.phone': 'ফোন নাম্বার (ঐচ্ছিক)',
            'modals.customer.repayDays': 'পরিশোধের সময়সীমা (দিন)',
            'modals.customer.note': 'নোট',
            'modals.debt.title': 'দেনা লিখুন',
            'modals.debt.customer': 'ক্রেতা',
            'modals.debt.customerPlaceholder': 'ক্রেতা নির্বাচন করুন',
            'modals.debt.amount': 'দেনার পরিমাণ (৳)',
            'modals.debt.description': 'বিবরণ',
            'modals.debt.date': 'তারিখ',
            'modals.payment.title': 'পেমেন্ট নিন',
            'modals.payment.amount': 'পেমেন্টের পরিমাণ (৳)',
            'modals.payment.date': 'তারিখ',
            'modals.payment.note': 'নোট',
            'modals.note.title': 'নতুন নোট',
            'modals.note.titleLabel': 'শিরোনাম',
            'modals.note.color': 'রং',
            'modals.note.colorYellow': 'হলুদ',
            'modals.note.colorGreen': 'সবুজ',
            'modals.note.colorBlue': 'নীল',
            'modals.note.colorPink': 'গোলাপি',
            'modals.note.colorGray': 'ধূসর',
            'modals.note.body': 'নোট',
            'modals.note.pinned': 'উপরে রাখুন',
            'modals.task.title': 'কাজ যোগ করুন',
            'modals.task.name': 'কাজের নাম',
            'modals.task.type': 'ধরন',
            'modals.task.typePayment': 'পেমেন্ট ফলো-আপ',
            'modals.task.typeDelivery': 'ডেলিভারি',
            'modals.task.typePurchase': 'মালামাল কেনা',
            'modals.task.typeOther': 'অন্যান্য',
            'modals.task.date': 'শেষ তারিখ',
            'modals.task.time': 'সময় (ঐচ্ছিক)',
            'modals.task.note': 'নোট',
            'modals.task.priority': 'অগ্রাধিকার',
            'modals.task.recurring': 'এই কাজ পুনরাবৃত্তি',
            'modals.task.recurringType': 'পুনরাবৃত্তি',
            'modals.task.typeWork': 'কাজ',
            'modals.task.typePersonal': 'ব্যক্তিগত',
            'modals.task.typeShopping': 'কেনাকাটা',
            'modals.profile.title': 'প্রোফাইল এডিট',
            'modals.profile.name': 'নাম',
            'modals.profile.email': 'ইমেইল',
            'modals.profile.profilePicture': 'প্রোফাইল ছবি',
            'modals.profile.extraPhoto': 'অতিরিক্ত ছবি',
            'modals.demand.title': 'পেমেন্ট দাবি',
            'modals.demand.amount': 'দাবির পরিমাণ (৳)',
            'modals.demand.dueDate': 'শেষ সময়',
            'modals.demand.method': 'পেমেন্ট পদ্ধতি / লিংক',
            'modals.demand.note': 'বার্তা',
            'modals.demand.generate': 'কার্ড তৈরি করুন',
            'modals.demand.share': 'শেয়ার',
            'modals.demand.download': 'ডাউনলোড',
            'modals.demand.previewText': 'এখানে দাবির কার্ড দেখা যাবে',
            'modals.shopProfile.title': 'দোকানের প্রোফাইল',
            'modals.shopProfile.ownerName': 'আপনার নাম',
            'modals.shopProfile.shopName': 'দোকানের নাম',
            'modals.shopProfile.phoneNumber': 'ফোন নম্বর',
            'modals.shopProfile.shopLogo': 'দোকানের লোগো/ছবি',
            'modals.shopProfile.yourPhoto': 'আপনার ছবি',
            'modals.shopProfile.paymentMethods': 'পেমেন্ট পদ্ধতি',
            'modals.shopProfile.bkashNumber': 'bKash নম্বর',
            'modals.shopProfile.nagadNumber': 'Nagad নম্বর',
            'modals.shopProfile.rocketNumber': 'Rocket নম্বর',
            'bills.title': 'বিলিং ও ইনভয়েস',
            'bills.subtitle': 'বিল তৈরি করুন এবং পেমেন্ট ট্র্যাক করুন',
            'bills.newBill': '+ নতুন বিল',
            'bills.balance': 'ব্যালেন্স',
            'bills.inflow': 'আয়',
            'bills.outflow': 'খরচ',
            'bills.history': 'ইতিহাস',
            'bills.thisMonth': 'এই মাস',
            'bills.lastMonth': 'গত মাস',
            'bills.thisYear': 'এই বছর',
            'bills.searchPlaceholder': 'ক্রেতা বা ইনভয়েস নম্বর দিয়ে খুঁজুন...',
            'bills.filterAll': 'সব',
            'bills.filterPaid': 'পরিশোধিত',
            'bills.filterPending': 'বাকি',
            'bills.filterOverdue': 'মেয়াদ উত্তীর্ণ',
            'bills.empty': 'এখনও কোনো বিল নেই। আপনার প্রথম বিল তৈরি করুন।',
            'bills.duplicate': 'অনুলিপি',
            'bills.view': 'দেখুন',
            'bills.share': 'শেয়ার',
            'bills.downloadPng': 'PNG ডাউনলোড',
            'bills.downloadPdf': 'PDF ডাউনলোড',
            'bills.makeInvoice': 'ইনভয়েস তৈরি',
            'bills.invoiceNumber': 'ইনভয়েস #',
            'bills.items': 'পণ্য',
            'bills.totalAmount': 'মোট',
            'bills.status': 'অবস্থা',
            'bills.dueDate': 'শেষ তারিখ',
            'bills.date': 'তারিখ',
            'bills.totalBills': 'মোট বিল',
            'bills.paidBills': 'পরিশোধিত',
            'bills.pendingBills': 'বাকি',
            'bills.overdueBills': 'মেয়াদ উত্তীর্ণ',
            'modals.bill.title': 'বিল / ইনভয়েস তৈরি',
            'modals.bill.subtitle': 'আপনার ক্রেতাদের জন্য পেশাদার বিল তৈরি করুন',
            'modals.bill.customerName': 'ক্রেতার নাম',
            'modals.bill.customerNameManual': 'অথবা ক্রেতার নাম লিখুন',
            'modals.bill.invoiceNumber': 'ইনভয়েস নম্বর (খালি রাখলে স্বয়ংক্রিয়)',
            'modals.bill.productsTitle': 'পণ্য / সেবা',
            'modals.bill.addProduct': 'পণ্য যোগ করুন',
            'modals.bill.subtotal': 'উপমোট',
            'modals.bill.discount': 'ছাড় (%)',
            'modals.bill.tax': 'কর (%) (ঐচ্ছিক)',
            'modals.bill.total': 'মোট পরিমাণ',
            'modals.bill.dueDate': 'শেষ তারিখ',
            'modals.bill.paymentStatus': 'পেমেন্ট অবস্থা',
            'modals.bill.statusPending': 'বাকি',
            'modals.bill.statusPaid': 'পরিশোধিত',
            'modals.bill.statusPartial': 'আংশিক',
            'modals.bill.notes': 'নোট / শর্তাবলী (ঐচ্ছিক)',
            'modals.bill.generateBill': 'বিল তৈরি করুন',
            'modals.billCustomize.title': 'বিল কার্ড কাস্টমাইজ',
            'modals.billCustomize.theme': 'থিম',
            'modals.billCustomize.themeMinimal': 'মিনিমাল',
            'modals.billCustomize.themeCozy': 'কোজি',
            'modals.billCustomize.themeProfessional': 'পেশাদার',
            'modals.billCustomize.layout': 'লেআউট স্টাইল',
            'modals.billCustomize.colors': 'রং',
            'modals.billCustomize.font': 'ফন্ট',
            'modals.billCustomize.spacing': 'স্পেসিং',
            'modals.billCustomize.border': 'বর্ডার',
            'modals.billCustomize.logo': 'দোকানের লোগো',
            'modals.billCustomize.fontSize': 'ফন্ট সাইজ',
            'modals.billCustomize.icons': 'আইকন',
            'modals.billCustomize.customNotes': 'কাস্টম নোট',
            'modals.billCustomize.sections': 'সেকশন ক্রম',
            'modals.billCustomize.preview': 'লাইভ প্রিভিউ',
            'modals.billCustomize.reset': 'রিসেট',
            'modals.billCustomize.apply': 'প্রয়োগ ও ডাউনলোড',
            'modals.monthlyWrap.title': 'মাসিক সারাংশ',
            'modals.monthlyWrap.loading': 'মাসিক সারাংশ লোড হচ্ছে...',
            'modals.cardCustomize.title': 'কার্ড কাস্টমাইজ',
            'modals.cardCustomize.style': 'কার্ড স্টাইল',
            'modals.cardCustomize.message': 'কাস্টম বার্তা',
            'modals.cardCustomize.emoji': 'ইমোজি যোগ করুন',
            'actions.close': 'বন্ধ',
            'actions.apply': 'প্রয়োগ',
            'footer.text': 'ডেবটএক্স আপনার খাতা রাখে সহজ ও নির্ভরযোগ্য',
            'ai.title': 'এআই এজেন্ট',
            'ai.subtitle': 'দেনা, কাজ ও নোটের জন্য শান্ত বাংলা সহায়ক',
            'ai.welcome': 'হ্যালো! আমি দেনা, কাজ, নোট এবং শান্ত সারাংশে সাহায্য করতে পারি। বাংলায় বলুন বা লিখুন—সেভ করার আগে আমি নিশ্চিত করব।',
            'ai.placeholder': 'বাংলা বা ইংরেজিতে লিখুন বা বলুন...',
            'ai.agentBadge': 'এআই এজেন্ট',
            'ai.agentTitle': 'শান্ত, বাংলা-প্রথম সহায়ক',
            'ai.agentHint': 'বাংলায় বললেই দেনা, কাজ বা নোট যোগ হবে—সবকিছু লোকালেই থাকে।',
            'ai.shortcut.summary': 'কাজের সারাংশ',
            'ai.shortcut.addTask': 'কাজ যোগ করুন',
            'ai.shortcut.addNote': 'নোট যোগ করুন',
            'ai.shortcut.addDebt': 'দেনা যোগ করুন',
            'ai.shortcut.theme': 'থিম বদলান',
            'ai.limitTitleFree': 'আজকের ফ্রি এআই লিমিট শেষ হয়েছে',
            'ai.limitBodyFree': 'আরও ব্যবহার করতে Max নিন।',
            'ai.limitTitleMax': 'আপনার Max সাইকেলের লিমিট শেষ হয়েছে',
            'ai.limitBodyMax': 'সবসময় আনলিমিটেড এআই পেতে Ultra নিন।',
            'ai.limitCta': 'প্ল্যান দেখুন',
            'ai.paywallLater': 'এখন নয়',
            'ai.paywallCta': 'Max প্ল্যান দেখুন',
            'pricing.kicker': 'সহজ ও পরিষ্কার প্ল্যান',
            'pricing.title': 'প্রথম দিন থেকেই এআই এক্সেস পরিষ্কার',
            'pricing.subtitle': 'এআই কতবার ব্যবহার হবে, ভয়েস কোথায় আছে—সব আগে থেকেই স্পষ্ট।',
            'pricing.currentLabel': 'বর্তমান প্ল্যান',
            'pricing.aiUsageLabel': 'এআই ব্যবহার',
            'pricing.perMonth': '/মাস',
            'pricing.perYear': '/বছর',
            'pricing.freePeriod': 'সবসময় ফ্রি',
            'pricing.freeTagline': 'বেসিক বাকি ও কাজের জন্য শুরু করুন।',
            'pricing.maxTagline': 'বড় হতে থাকা দোকানের জন্য বেশি এআই সহায়তা।',
            'pricing.ultraTagline': 'ব্যস্ত দিনের জন্য আনলিমিটেড এআই।',
            'pricing.usagePreviewLabel': 'AI ব্যবহার প্রিভিউ',
            'pricing.usagePreviewFree': '০/৩০ আজ',
            'pricing.usagePreviewMax': '১২/১০০ এই মাসে',
            'pricing.usagePreviewUltra': 'আনলিমিটেড',
            'pricing.couponPlaceholder': 'কুপন কোড লিখুন',
            'pricing.free.feature1': 'বেসিক বাকি + কাজ',
            'pricing.free.feature2': 'এআই এজেন্ট: দিনে ৩০ বার',
            'pricing.free.feature3': 'বেসিক ভয়েস ইনপুট (সীমিত কমান্ড)',
            'pricing.max.feature1': 'এআই এজেন্ট: প্রতি সাইকেলে ১০০ বার',
            'pricing.max.feature2': 'ডকের AI বাটন সম্পূর্ণ এনাবল',
            'pricing.max.feature3': 'থিম বদল, অটোমেশন ও কন্ট্রোল',
            'pricing.ultra.feature1': 'আনলিমিটেড এআই এজেন্ট',
            'pricing.ultra.feature2': 'সব ফিচার আনলক',
            'pricing.ultra.feature3': 'প্রায়োরিটি অটোমেশন ও কন্ট্রোল',
            'pricing.footnote': 'কোন পেইড API নেই। অফলাইনে কাজ করে এবং ডেটা আপনার কাছেই থাকে।',
            'home.quick.customers': 'ক্রেতা খুলুন',
            'home.quick.bills': 'বিল ও ইনভয়েস',
            'home.quick.settings': 'সেটিংস',
            'docs.title': 'ভয়েস + No API গাইড',
            'docs.subtitle': 'বাংলা-প্রথম ভয়েস ও এজেন্ট কীভাবে কাজ করে দেখুন।',
            'docs.voice.title': 'ভয়েস ফ্লো',
            'docs.voice.step1': 'বাংলা + ইংরেজি স্পিচ ট্রান্সক্রাইব',
            'docs.voice.step2': 'ফিল্ড বের করা: নাম, টাকা, টাইপ, তারিখ, নোট, সময়',
            'docs.voice.step3': 'ফর্ম অটো-ফিল',
            'docs.voice.step4': 'প্রিভিউ দেখিয়ে কনফার্ম',
            'docs.voice.where': 'Add Baki, Add Task, Quick Add, এবং Agent-এ মাইক সবসময় থাকবে।',
            'docs.noapi.title': 'No API এজেন্ট',
            'docs.noapi.body': 'রুল-বেসড intent parser (keywords + regex + entity extraction)। পরে চাইলে লোকাল মডেল যোগ করা যাবে।',
            'docs.examples.title': 'ন্যাচারাল বাংলা উদাহরণ',
            'voice.listening': 'শোনা হচ্ছে...',
            'voice.preview.title': 'ভয়েস প্রিভিউ',
            'voice.preview.confirmQuestion': 'ঠিক আছে? Save করবো?',
            'voice.preview.customer': 'ক্রেতা',
            'voice.preview.amount': 'টাকা',
            'voice.preview.type': 'ধরন',
            'voice.preview.date': 'তারিখ',
            'voice.preview.time': 'সময়',
            'voice.preview.task': 'কাজ',
            'voice.preview.note': 'নোট',
            'voice.preview.edit': 'এডিট',
            'voice.preview.confirmCta': 'সেভ করুন',
            'ai.ultraOnly': 'শুধু Ultra',
            'ai.ultraExclusive': 'এআই চ্যাট - Ultra একচেটিয়া',
            'notifications.enabled': 'রিমাইন্ডার চালু',
            'notifications.disabled': 'রিমাইন্ডার বন্ধ',
            'notifications.permissionDenied': 'ব্রাউজারের সেটিং থেকে নোটিফিকেশন চালু করুন',
            'notifications.dueToday': 'আজ পেমেন্ট নেওয়ার সময়',
            'notifications.dueTodayBody': 'আজ পরিশোধ করুন: {amount}',
            'notifications.overdue': 'বাকি পড়েছে',
            'notifications.overdueBody': 'এখনও বাকি: {amount}',
            'notifications.taskDue': 'আজকের কাজ:',
            'notifications.taskDueBody': '{task}',
            'calendar.monthNames': [
                'জানুয়ারি', 'ফেব্রুয়ারি', 'মার্চ', 'এপ্রিল', 'মে', 'জুন',
                'জুলাই', 'আগস্ট', 'সেপ্টেম্বর', 'অক্টোবর', 'নভেম্বর', 'ডিসেম্বর'
            ],
            'calendar.dayNames': ['র', 'সো', 'মো', 'বু', 'বৃ', 'শু', 'শো'],
            'calendar.empty': 'এই দিনে কিছু নেই কাজ যোগ করুন বা দেনা লিখুন',
            'onboarding.welcome': 'DebtX-এ স্বাগতম!',
            'onboarding.subtitle': 'আসুন দেখি কিভাবে শুরু করবেন',
            'onboarding.skip': 'টিউটোরিয়াল বাদ দিন',
            'onboarding.next': 'পরবর্তী',
            'onboarding.prev': 'আগের',
            'onboarding.done': 'শুরু করুন',
            'onboarding.step1.title': 'প্রথম ক্রেতা যোগ করুন',
            'onboarding.step1.desc': 'ক্রেতাদের দেনা ও পেমেন্ট ট্র্যাক করতে প্রথমে তাদের যোগ করুন। ক্রেতা পেজে + বোতামে ট্যাপ করুন।',
            'onboarding.step2.title': 'দেনা ও পেমেন্ট রেকর্ড করুন',
            'onboarding.step2.desc': 'ক্রেতা যোগ করার পর, বাকিতে কিনলে দেনা এবং টাকা দিলে পেমেন্ট রেকর্ড করুন।',
            'onboarding.step3.title': 'প্রফেশনাল বিল তৈরি করুন',
            'onboarding.step3.desc': 'বিলস সেকশনে গিয়ে সুন্দর প্রফেশনাল বিল তৈরি করুন। আইটেম যোগ করুন, দাম সেট করুন, প্রিন্টযোগ্য বিল তৈরি করুন।',
            'onboarding.step4.title': 'আপনি তৈরি!',
            'onboarding.step4.desc': 'দ্রুত নোটের জন্য Notes, স্মার্ট ফিচারের জন্য AI Tools এবং কাস্টমাইজের জন্য Settings এক্সপ্লোর করুন।'
        }
    };

    const state = loadState();
    let lastDemandCardUrl = '';
    let draggedTaskId = '';

    const selectors = {
        nav: {
            premium: document.getElementById('nav-premium'),
            customers: document.getElementById('nav-customers'),
            tasks: document.getElementById('nav-tasks'),
            notes: document.getElementById('nav-notes'),
            settings: document.getElementById('nav-settings'),
            ai: document.getElementById('nav-ai'),
            bills: document.getElementById('nav-bills'),
        },
        panels: {
            customers: document.getElementById('panel-customers'),
            bills: document.getElementById('panel-bills'),
            ai: document.getElementById('panel-ai'),
            notes: document.getElementById('panel-notes'),
            settings: document.getElementById('panel-settings'),
            premium: document.getElementById('panel-premium')
        },
        premiumCornerBtn: document.getElementById('premium-corner-btn'),
        languageToggle: document.getElementById('language-toggle'),
        notificationToggle: document.getElementById('notification-toggle'),
        customerList: document.getElementById('customer-list'),
        customersEmpty: document.getElementById('customers-empty'),
        customerSearch: document.getElementById('customer-search'),
        customersTabs: document.querySelectorAll('[data-customers-tab]'),
        customersView: document.getElementById('customers-view'),
        debtsView: document.getElementById('debts-view'),
        debtList: document.getElementById('debt-list'),
        debtSearch: document.getElementById('debt-search'),
        debtEmpty: document.getElementById('debt-empty'),
        notesList: document.getElementById('notes-list'),
        notesEmpty: document.getElementById('notes-empty'),
        notesSearch: document.getElementById('notes-search'),
        notesFilter: document.getElementById('notes-filter'),
        tasksList: document.getElementById('tasks-list'),
        tasksEmpty: document.getElementById('tasks-empty'),
        miniCalendar: document.getElementById('mini-calendar'),
        tasksMiniCalendar: document.getElementById('tasks-mini-calendar'),
        aiDebtCalendarList: document.getElementById('ai-debt-calendar-list'),
        aiDebtCalendarRefresh: document.getElementById('ai-debt-calendar-refresh'),
        addCustomerBtn: document.getElementById('add-customer-btn'),
        addNoteBtn: document.getElementById('add-note-btn'),
        authOverlay: document.getElementById('auth-overlay'),
        authTabs: document.querySelectorAll('.auth-tab'),
        authLoginForm: document.getElementById('auth-login-form'),
        authSetupForm: document.getElementById('auth-setup-form'),
        authError: document.getElementById('auth-error'),
        authCloseBtn: document.getElementById('auth-close-btn'),
        authSkipBtn: document.getElementById('auth-skip-btn'),
        authPreviewProfile: document.getElementById('auth-preview-profile'),
        authPreviewExtra: document.getElementById('auth-preview-extra'),
        profileUploadPreview: document.getElementById('profile-upload-preview'),
        userPill: document.getElementById('user-pill'),
        userName: document.getElementById('user-name'),
        userEmail: document.getElementById('user-email'),
        userAvatar: document.getElementById('user-avatar'),
        lockBtn: document.getElementById('lock-btn'),
        themeGrid: document.getElementById('theme-grid'),
        toggleHaptics: document.getElementById('toggle-haptics'),
        toggleSounds: document.getElementById('toggle-sounds'),
        aiRefreshBtn: document.getElementById('ai-refresh-btn'),
        aiSummaryText: document.getElementById('ai-summary-text'),
        demandPreviewImg: document.getElementById('demand-preview-img'),
        demandDownloadBtn: document.getElementById('demand-download-btn'),
        demandShareBtn: document.getElementById('demand-share-btn'),
        demandPreviewText: document.querySelector('#demand-preview p'),
        exportDataBtn: document.getElementById('export-data-btn'),
        importDataInput: document.getElementById('import-data-input'),
        dataStatus: document.getElementById('data-status'),
        calculatorButtons: document.querySelectorAll('.calc-btn'),
        calcExpression: document.getElementById('calc-expression'),
        calcResult: document.getElementById('calc-result'),
        notesSection: document.getElementById('notes-section'),
        tasksSection: document.getElementById('tasks-section'),
        notesTabBtn: document.querySelector('[data-tab="notes"]'),
        tasksTabBtn: document.querySelector('[data-tab="tasks"]'),
        activateProBtn: document.getElementById('activate-pro-btn'),
        activateMaxBtn: document.getElementById('activate-max-btn'),
        activateUltraBtn: document.getElementById('activate-ultra-btn'),
        couponPro: document.getElementById('coupon-pro'),
        couponMax: document.getElementById('coupon-max'),
        couponUltra: document.getElementById('coupon-ultra'),
        logoListContainer: document.getElementById('logo-list-container'),
        addLogoBtn: document.getElementById('add-logo-btn'),
        dockSizeInput: document.getElementById('dock-size-range'),
        dockSizeValue: document.getElementById('dock-size-value'),
        uiScaleInput: document.getElementById('ui-scale-range'),
        uiScaleValue: document.getElementById('ui-scale-value'),
        simpleTodoToggle: document.getElementById('simple-todo-toggle')
    };

    const modals = {
        customer: document.getElementById('customer-modal'),
        debt: document.getElementById('debt-modal'),
        payment: document.getElementById('payment-modal'),
        bill: document.getElementById('bill-modal'),
        billCustomize: document.getElementById('bill-customize-modal'),
        note: document.getElementById('note-modal'),
        task: document.getElementById('task-modal'),
        demand: document.getElementById('demand-modal'),
        profile: document.getElementById('profile-modal'),
        shopProfile: document.getElementById('shop-profile-modal'),
        monthlyWrap: document.getElementById('monthly-wrap-modal'),
        cardCustomize: document.getElementById('card-customize-modal'),
        logo: document.getElementById('logo-modal')
    };

    const forms = {
        customer: document.getElementById('customer-form'),
        debt: document.getElementById('debt-form'),
        payment: document.getElementById('payment-form'),
        note: document.getElementById('note-form'),
        task: document.getElementById('task-form'),
        bill: document.getElementById('bill-form'),
        demand: document.getElementById('demand-form'),
        profile: document.getElementById('profile-form'),
        shopProfile: document.getElementById('shop-profile-form'),
        cardCustomize: document.getElementById('card-customize-form'),
        logo: document.getElementById('logo-form')
    };

    const templates = {
        customerCard: document.getElementById('customer-card-template'),
        noteCard: document.getElementById('note-card-template'),
        taskCard: document.getElementById('task-card-template')
    };

    init();

    function init() {
        console.log('Debtx init starting...');

        attachNavHandlers();
        attachModalHandlers();
        attachFormHandlers();
        attachMiscHandlers();
        attachAuthHandlers();
        attachNewFeatureHandlers();
        registerServiceWorker();
        applyLanguage(state.language, { initial: true });
        applyTheme(state.ui.theme, { initial: true });
        applyTextSize(state.ui.textSize || 3);
        applyDockScale(state.ui.dockScale || 1);
        applyUiScale(state.ui.uiScale || 1);
        applyViewMode(state.ui.viewMode || 'phone');
        applyTodoMode(state.ui.simpleTodo);
        applyPlanBranding();
        highlightPlanCards();
        setBillingMode(state.ui.pricingBilling || 'annual');

        // Initialize text size button
        const currentSize = state.ui.textSize || 3;
        document.querySelectorAll('.text-size-btn').forEach(btn => {
            if (parseInt(btn.dataset.size) === currentSize) {
                btn.classList.add('active');
            }
        });

        // No initial auth overlay - login moved to settings
        renderAll();
        setCustomersTab(state.ui.customersTab || 'customers', { save: false });

        startReminderLoop();
        refreshAISummary();
        updateAIUsageUI();
        updateAIBuddyName();

        // Initialize notes/tasks tab on load
        if (state.ui.activeNotesTab) {
            switchNotesTab(state.ui.activeNotesTab);
        }

        // Show welcome toast once per session
        if (!sessionStorage.getItem('debtx-welcome-shown')) {
            showToast("World's First AI Agent Digital Khata App");
            sessionStorage.setItem('debtx-welcome-shown', 'true');
        }
    }

    function loadState() {
        try {
            const raw = localStorage.getItem(STORAGE_KEY);
            if (!raw) {
                return defaultState();
            }
            const parsed = JSON.parse(raw);
            if (parsed.version !== LS_VERSION) {
                return Object.assign(defaultState(), parsed, { version: LS_VERSION });
            }
            parsed.ui = Object.assign(defaultState().ui, parsed.ui || {});
            parsed.auth = Object.assign(defaultState().auth, parsed.auth || {});
            parsed.language = parsed.language === 'bn' ? 'bn' : 'en';
            parsed.shopLogos = parsed.shopLogos || [];
            parsed.calculator = Object.assign(defaultState().calculator, parsed.calculator || {});
            parsed.subscription = Object.assign(defaultState().subscription, parsed.subscription || {});
            // Guest users stay unlocked, password users need to re-authenticate
            const isGuest = parsed.auth?.isGuest || false;
            parsed.session = { unlocked: isGuest };
            parsed.notes = (parsed.notes || []).map(note => Object.assign(
                {
                    color: 'yellow',
                    pinned: false,
                    updatedAt: note?.createdAt || Date.now()
                },
                note
            ));
            parsed.customers = (parsed.customers || []).map(prepareCustomerRecord);
            parsed.tasks = (parsed.tasks || []).map(task => Object.assign({ reminderSent: false }, task));
            parsed.ai = Object.assign(defaultState().ai, parsed.ai || {});
            // Ensure buddyName exists
            if (!parsed.ai.buddyName) {
                parsed.ai.buddyName = 'Assistant';
            }
            return Object.assign(defaultState(), parsed);
        } catch (error) {
            console.error('Failed to load state', error);
            return defaultState();
        }
    }

    function saveState() {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    }

    function exportDataAsJSON() {
        try {
            const exportData = {
                exportedAt: new Date().toISOString(),
                version: LS_VERSION,
                language: state.language,
                notificationsEnabled: state.notificationsEnabled,
                auth: {
                    name: state.auth.name,
                    email: state.auth.email,
                    profilePicture: state.auth.profilePicture,
                    extraPhoto: state.auth.extraPhoto,
                    // Note: passwords are NOT exported for security
                    createdAt: state.auth.createdAt
                },
                customers: state.customers,
                notes: state.notes,
                tasks: state.tasks,
                bills: state.bills || [],
                shopLogos: state.shopLogos || [],
                shop: state.shop || defaultState().shop,
                subscription: state.subscription || defaultState().subscription,
                ai: state.ai || defaultState().ai,
                ui: {
                    theme: state.ui.theme,
                    haptics: state.ui.haptics,
                    sounds: state.ui.sounds,
                    textSize: state.ui.textSize,
                    dockScale: state.ui.dockScale,
                    uiScale: state.ui.uiScale,
                    viewMode: state.ui.viewMode
                }
            };
            const jsonString = JSON.stringify(exportData, null, 2);
            const blob = new Blob([jsonString], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `debtx-backup-${new Date().toISOString().slice(0, 10)}.json`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
            showDataStatus(translate('settings.exportSuccess'), 'success');
        } catch (error) {
            console.error('Export failed:', error);
            showDataStatus(translate('settings.exportError'), 'error');
        }
    }

    async function importDataFromJSON(file) {
        try {
            const text = await file.text();
            const imported = JSON.parse(text);
            if (!imported || typeof imported !== 'object') {
                throw new Error('Invalid JSON structure');
            }
            const hasData = Array.isArray(imported.customers) || Array.isArray(imported.notes) || Array.isArray(imported.tasks) ||
                Array.isArray(imported.bills) || (imported.shop && typeof imported.shop === 'object');
            if (!hasData) {
                throw new Error('No data found in file');
            }
            // Merge imported data - keep existing auth passwords
            if (imported.auth) {
                state.auth.name = imported.auth.name || state.auth.name;
                state.auth.email = imported.auth.email || state.auth.email;
                if (imported.auth.profilePicture) state.auth.profilePicture = imported.auth.profilePicture;
                if (imported.auth.extraPhoto) state.auth.extraPhoto = imported.auth.extraPhoto;
            }
            if (imported.customers && Array.isArray(imported.customers)) {
                // Merge customers - avoid duplicates by ID
                const existingIds = new Set(state.customers.map(c => c.id));
                imported.customers.forEach(customer => {
                    const prepared = prepareCustomerRecord(customer);
                    if (existingIds.has(customer.id)) {
                        const idx = state.customers.findIndex(c => c.id === customer.id);
                        if (idx >= 0) state.customers[idx] = prepared;
                    } else {
                        state.customers.push(prepared);
                    }
                });
            }
            if (imported.notes && Array.isArray(imported.notes)) {
                const existingIds = new Set(state.notes.map(n => n.id));
                imported.notes.forEach(note => {
                    if (existingIds.has(note.id)) {
                        const idx = state.notes.findIndex(n => n.id === note.id);
                        if (idx >= 0) state.notes[idx] = note;
                    } else {
                        state.notes.push(note);
                    }
                });
            }
            if (imported.tasks && Array.isArray(imported.tasks)) {
                const existingIds = new Set(state.tasks.map(t => t.id));
                imported.tasks.forEach(task => {
                    if (existingIds.has(task.id)) {
                        const idx = state.tasks.findIndex(t => t.id === task.id);
                        if (idx >= 0) state.tasks[idx] = Object.assign({ reminderSent: false }, task);
                    } else {
                        state.tasks.push(Object.assign({ reminderSent: false }, task));
                    }
                });
            }
            if (imported.bills && Array.isArray(imported.bills)) {
                const existingIds = new Set((state.bills || []).map(b => b.id));
                state.bills = state.bills || [];
                imported.bills.forEach(bill => {
                    if (bill && bill.id != null) {
                        if (existingIds.has(bill.id)) {
                            const idx = state.bills.findIndex(b => b.id === bill.id);
                            if (idx >= 0) state.bills[idx] = bill;
                        } else {
                            state.bills.push(bill);
                        }
                    } else {
                        state.bills.push(bill);
                    }
                });
            }
            if (imported.shopLogos && Array.isArray(imported.shopLogos)) {
                const existingIds = new Set((state.shopLogos || []).map(l => l.id));
                state.shopLogos = state.shopLogos || [];
                imported.shopLogos.forEach(logo => {
                    if (logo && logo.id && existingIds.has(logo.id)) {
                        const idx = state.shopLogos.findIndex(l => l.id === logo.id);
                        if (idx >= 0) state.shopLogos[idx] = logo;
                    } else {
                        state.shopLogos.push(logo);
                    }
                });
            }
            if (imported.shop && typeof imported.shop === 'object') {
                state.shop = Object.assign({}, defaultState().shop, state.shop, imported.shop);
            }
            if (imported.subscription && typeof imported.subscription === 'object') {
                state.subscription = Object.assign({}, defaultState().subscription, state.subscription, imported.subscription);
            }
            if (imported.ai && typeof imported.ai === 'object') {
                state.ai = Object.assign({}, defaultState().ai, state.ai, imported.ai);
            }
            if (imported.ui) {
                if (imported.ui.theme) {
                    state.ui.theme = imported.ui.theme;
                    applyTheme(imported.ui.theme);
                }
                if (typeof imported.ui.haptics === 'boolean') state.ui.haptics = imported.ui.haptics;
                if (typeof imported.ui.sounds === 'boolean') state.ui.sounds = imported.ui.sounds;
                if (typeof imported.ui.textSize === 'number' && imported.ui.textSize >= 1 && imported.ui.textSize <= 5) {
                    state.ui.textSize = imported.ui.textSize;
                    applyTextSize(state.ui.textSize);
                }
                if (typeof imported.ui.dockScale === 'number' && imported.ui.dockScale >= 0.2 && imported.ui.dockScale <= 1) {
                    state.ui.dockScale = imported.ui.dockScale;
                    applyDockScale(state.ui.dockScale);
                    if (selectors.dockSizeInput) selectors.dockSizeInput.value = state.ui.dockScale;
                    updateDockScaleDisplay();
                }
                if (typeof imported.ui.uiScale === 'number' && imported.ui.uiScale >= 0.8 && imported.ui.uiScale <= 1) {
                    state.ui.uiScale = imported.ui.uiScale;
                    applyUiScale(state.ui.uiScale);
                    if (selectors.uiScaleInput) selectors.uiScaleInput.value = state.ui.uiScale;
                    updateUiScaleDisplay();
                }
                if (typeof imported.ui.viewMode === 'string') {
                    state.ui.viewMode = imported.ui.viewMode === 'desktop' ? 'desktop' : 'phone';
                    applyViewMode(state.ui.viewMode);
                }
                if (typeof imported.ui.simpleTodo === 'boolean') {
                    state.ui.simpleTodo = imported.ui.simpleTodo;
                    applyTodoMode(state.ui.simpleTodo);
                }
            }
            if (imported.language) {
                state.language = imported.language;
                applyLanguage(state.language);
            }
            if (typeof imported.notificationsEnabled === 'boolean') {
                state.notificationsEnabled = imported.notificationsEnabled;
            }
            saveState();
            renderAll();
            updateUserBadge();
            updateSettingsToggles();
            updateSettingsDisplay();
            if (typeof updateNewSettingsUI === 'function') updateNewSettingsUI();
            if (typeof updateDockPremiumVisibility === 'function') updateDockPremiumVisibility();
            refreshAISummary();
            showDataStatus(translate('settings.importSuccess'), 'success');
        } catch (error) {
            console.error('Import failed:', error);
            showDataStatus(translate('settings.importError'), 'error');
        }
    }

    function showDataStatus(message, type) {
        if (!selectors.dataStatus) return;
        selectors.dataStatus.textContent = message;
        selectors.dataStatus.className = `data-status data-status--${type}`;
        setTimeout(() => {
            selectors.dataStatus.textContent = '';
            selectors.dataStatus.className = 'data-status';
        }, 4000);
    }

    function prepareCustomerRecord(customer) {
        const prepared = Object.assign(
            {
                debts: [],
                payments: [],
                history: [],
                lastPaymentAt: null,
                createdAt: Date.now(),
                updatedAt: Date.now()
            },
            customer
        );

        const parsedRepaymentDays = parseInt(prepared.repaymentDays, 10);
        prepared.repaymentDays = clampNumber(Number.isNaN(parsedRepaymentDays) ? 7 : parsedRepaymentDays, 1, 90);
        prepared.debts = (prepared.debts || [])
            .map(debt => normalizeDebtRecord(debt, prepared))
            .filter(Boolean);
        prepared.payments = prepared.payments || [];
        prepared.history = prepared.history || [];
        return prepared;
    }

    function normalizeDateInput(value) {
        if (!value) return todayString();
        if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
            return value;
        }
        const date = new Date(value);
        if (Number.isNaN(date.getTime())) return todayString();
        return date.toISOString().slice(0, 10);
    }

    function normalizeDebtRecord(debt, customer) {
        if (!debt || typeof debt !== 'object') return null;
        debt.amount = Math.max(0, Number(debt.amount) || 0);
        debt.paidAmount = Math.max(0, Number(debt.paidAmount) || 0);
        debt.description = (debt.description || '').toString();
        debt.date = normalizeDateInput(debt.date || debt.createdAt);
        const dueDate = debt.dueDate ? normalizeDateInput(debt.dueDate) : '';
        const hasValidDueDate = dueDate && !Number.isNaN(new Date(`${dueDate}T00:00`).getTime());
        const repaymentDays = Number(customer?.repaymentDays) || 7;
        debt.dueDate = hasValidDueDate ? dueDate : computeDueDate(debt.date, repaymentDays);
        debt.reminders = Object.assign({ dueToday: false, overdue: false }, debt.reminders || {});
        if (!debt.id) debt.id = generateId('debt');
        return debt;
    }

    function attachNavHandlers() {
        const navActions = {
            customers: () => {
                setActivePanel('customers');
                setCustomersTab('customers');
            },
            tasks: () => {
                setActivePanel('notes');
                switchNotesTab('tasks');
            },
            notes: () => {
                setActivePanel('notes');
                switchNotesTab('notes');
            },
            settings: () => setActivePanel('settings'),
            bills: () => setActivePanel('bills'),
            premium: () => setActivePanel('premium'),
            ai: () => {
                const usage = getAIUsageInfo();
                if (usage.plan === 'free' && usage.limit !== Infinity && usage.remaining <= 0) {
                    openAIPaywallModal();
                    return;
                }
                setActivePanel('ai');
            }
        };

        Object.entries(selectors.nav).forEach(([key, btn]) => {
            if (!btn) return;
            // Do not set data-i18n on the button: labels use data-i18n and applyLanguage would wipe icon+label
            btn.addEventListener('click', () => {
                playFeedback();
                const action = navActions[key];
                if (action) action();
            });
        });
        if (selectors.premiumCornerBtn) {
            selectors.premiumCornerBtn.addEventListener('click', () => {
                playFeedback();
                setActivePanel('premium');
            });
        }
        setActivePanel(state.ui.activePanel);
    }

    function attachModalHandlers() {
        document.querySelectorAll('[data-close]').forEach(btn => {
            btn.addEventListener('click', () => {
                playFeedback();
                const dialog = btn.closest('dialog');
                if (dialog) dialog.close();
            });
        });

        Object.values(modals).forEach(dialog => {
            if (!dialog) return;
            dialog.addEventListener('cancel', () => {
                dialog.close();
            });
        });

        selectors.addCustomerBtn?.addEventListener('click', () => {
            playFeedback();
            forms.customer.reset();
            setModalMode(forms.customer, 'create');
            modals.customer.showModal();
        });

        selectors.addNoteBtn?.addEventListener('click', () => {
            playFeedback();
            forms.note.reset();
            setModalMode(forms.note, 'create');
            forms.note.elements.noteId.value = '';
            forms.note.elements.color.value = 'yellow';
            forms.note.elements.pinned.checked = false;
            modals.note.showModal();
        });

        document.getElementById('add-task-btn')?.addEventListener('click', () => {
            playFeedback();
            forms.task.reset();
            setModalMode(forms.task, 'create');
            if (forms.task.elements.taskId) forms.task.elements.taskId.value = '';
            if (forms.task.elements.type) forms.task.elements.type.value = 'personal';
            if (forms.task.elements.priority) forms.task.elements.priority.value = 'medium';
            if (forms.task.elements.recurring) forms.task.elements.recurring.checked = false;
            const recurringOptions = document.getElementById('recurring-options');
            if (recurringOptions) recurringOptions.style.display = 'none';
            hideTaskVoicePreview();
            modals.task.showModal();
        });

        // FAB button handler moved to attachNewFeatureHandlers for context-aware behavior

        // Recurring task toggle
        const recurringCheckbox = forms.task?.elements.recurring;
        const recurringOptions = document.getElementById('recurring-options');
        if (recurringCheckbox && recurringOptions) {
            recurringCheckbox.addEventListener('change', () => {
                recurringOptions.style.display = recurringCheckbox.checked ? 'block' : 'none';
            });
        }

        document.getElementById('debt-voice-edit')?.addEventListener('click', () => {
            hideDebtVoicePreview();
        });
        document.getElementById('debt-voice-confirm')?.addEventListener('click', () => {
            if (forms.debt?.reportValidity()) {
                forms.debt.requestSubmit();
            }
        });
        document.getElementById('task-voice-edit')?.addEventListener('click', () => {
            hideTaskVoicePreview();
        });
        document.getElementById('task-voice-confirm')?.addEventListener('click', () => {
            if (forms.task?.reportValidity()) {
                forms.task.requestSubmit();
            }
        });

    }

    function attachFormHandlers() {
        forms.customer?.addEventListener('submit', handleCustomerSubmit);
        forms.debt?.addEventListener('submit', handleDebtSubmit);
        forms.payment?.addEventListener('submit', handlePaymentSubmit);
        forms.note?.addEventListener('submit', handleNoteSubmit);
        forms.task?.addEventListener('submit', handleTaskSubmit);
        forms.bill?.addEventListener('submit', handleBillSubmit);
        forms.demand?.addEventListener('submit', handleDemandSubmit);
        forms.profile?.addEventListener('submit', async event => {
            event.preventDefault();
            await handleProfileSubmit(event);
        });
    }

    function attachMiscHandlers() {
        // ... (preserving existing handlers by appending after them)

        // Note Tab Switching
        document.querySelectorAll('.notes-tab-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                state.ui.notesTab = btn.dataset.tab;
                saveState();
                renderNotesV3();
                playFeedback();
            });
        });

        // Add Habit Button
        document.getElementById('add-habit-btn')?.addEventListener('click', () => {
            forms.task.reset();
            setModalMode(forms.task, 'add');
            modals.task.showModal();
        });

        // New Note FAB
        document.getElementById('fab-add-note')?.addEventListener('click', () => {
            forms.note.reset();
            setModalMode(forms.note, 'add');
            modals.note.showModal();
        });
        selectors.languageToggle?.addEventListener('click', () => {
            const nextLang = state.language === 'en' ? 'bn' : 'en';
            applyLanguage(nextLang);
            saveState();
        });

        document.querySelectorAll('.quick-action-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const panel = btn.dataset.panel;
                if (!panel) return;
                playFeedback();
                setActivePanel(panel);
            });
        });

        // Language toggle removed with settings panel
        const languageToggleSettings = document.getElementById('language-toggle-settings');
        if (languageToggleSettings) {
            languageToggleSettings.addEventListener('click', () => {
                const nextLang = state.language === 'en' ? 'bn' : 'en';
                applyLanguage(nextLang);
                saveState();
                playFeedback();
            });
        }

        selectors.notificationToggle?.addEventListener('click', handleNotificationToggle);

        selectors.customerSearch?.addEventListener('input', debounce(() => {
            renderCustomers();
        }, 150));

        selectors.notesSearch?.addEventListener('input', debounce(() => {
            state.ui.notesQuery = (selectors.notesSearch?.value || '').trim().toLowerCase();
            saveState();
            renderNotes();
        }, 150));

        // Notes filter button handlers
        document.querySelectorAll('#notes-section .filter-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const filter = btn.dataset.filter;
                if (filter) {
                    // Update active state
                    document.querySelectorAll('#notes-section .filter-btn').forEach(b => b.classList.remove('active'));
                    btn.classList.add('active');

                    state.ui.notesFilter = filter;
                    saveState();
                    renderNotes();
                    playFeedback();
                }
            });
        });

        // Color filter buttons (legacy)
        document.querySelectorAll('#notes-section .color-filter-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const color = btn.dataset.color;
                if (color) {
                    // Toggle active state
                    btn.classList.toggle('active');

                    // Update filter to show selected colors
                    const activeColors = Array.from(document.querySelectorAll('#notes-section .color-filter-btn.active')).map(b => b.dataset.color);
                    if (activeColors.length > 0) {
                        // Filter by active colors
                        state.ui.notesColorFilter = activeColors;
                    } else {
                        state.ui.notesColorFilter = null;
                    }
                    saveState();
                    renderNotes();
                    playFeedback();
                }
            });
        });

        // New Color Filter Pills (V2)
        document.querySelectorAll('.color-filter-pill').forEach(btn => {
            btn.addEventListener('click', () => {
                const color = btn.dataset.color;
                if (color) {
                    // Update active state - single selection
                    document.querySelectorAll('.color-filter-pill').forEach(b => b.classList.remove('active'));
                    btn.classList.add('active');

                    // Update filter
                    state.ui.notesColorFilter = color;
                    saveState();
                    renderNotes();
                    playFeedback();
                }
            });
        });

        // Empty state add note button
        document.getElementById('empty-add-note-btn')?.addEventListener('click', () => {
            setModalMode(forms.note, 'create');
            forms.note.reset();
            if (forms.note.elements.noteId) forms.note.elements.noteId.value = '';
            if (forms.note.elements.color) forms.note.elements.color.value = 'yellow';
            if (forms.note.elements.pinned) forms.note.elements.pinned.checked = false;
            modals.note.showModal();
        });

        // Legacy select filter (if it exists)
        selectors.notesFilter?.addEventListener('change', event => {
            state.ui.notesFilter = event.target.value;
            saveState();
            renderNotes();
        });

        selectors.lockBtn?.addEventListener('click', () => {
            lockSession();
        });


        selectors.themeGrid?.addEventListener('click', event => {
            const btn = event.target.closest('[data-theme]');
            if (!btn) return;
            const theme = btn.dataset.theme;
            applyTheme(theme);
            saveState();
        });

        selectors.editProfileBtn?.addEventListener('click', () => {
            openProfileModal();
        });

        selectors.toggleHaptics?.addEventListener('change', e => {
            state.ui.haptics = !!e.target.checked;
            saveState();
        });

        selectors.toggleSounds?.addEventListener('change', e => {
            state.ui.sounds = !!e.target.checked;
            saveState();
        });

        selectors.aiRefreshBtn?.addEventListener('click', () => {
            refreshAISummary();
            playFeedback();
        });

        selectors.exportDataBtn?.addEventListener('click', () => {
            exportDataAsJSON();
            playFeedback();
        });

        selectors.importDataInput?.addEventListener('change', async event => {
            const file = event.target.files?.[0];
            if (file) {
                await importDataFromJSON(file);
                playFeedback();
            }
            event.target.value = '';
        });

        // Notes FAB button handler
        document.getElementById('notes-fab')?.addEventListener('click', () => {
            playFeedback();
            forms.note.reset();
            setModalMode(forms.note, 'create');
            if (forms.note.elements.noteId) forms.note.elements.noteId.value = '';
            if (forms.note.elements.color) forms.note.elements.color.value = 'yellow';
            if (forms.note.elements.pinned) forms.note.elements.pinned.checked = false;
            modals.note.showModal();
        });

        // Onboarding handlers
        attachOnboardingHandlers();
    }

    function attachOnboardingHandlers() {
        const modal = document.getElementById('onboarding-modal');
        const skipBtn = document.getElementById('onboarding-skip');
        const prevBtn = document.getElementById('onboarding-prev');
        const nextBtn = document.getElementById('onboarding-next');
        const dots = document.querySelectorAll('.onboarding-dots .dot');
        const slides = document.querySelectorAll('.onboarding-slide');

        if (!modal) return;

        let currentStep = 0;
        const totalSteps = slides.length;

        function updateSlide() {
            slides.forEach((slide, i) => {
                slide.classList.toggle('active', i === currentStep);
            });
            dots.forEach((dot, i) => {
                dot.classList.toggle('active', i === currentStep);
            });

            // Update prev button visibility
            prevBtn.style.visibility = currentStep === 0 ? 'hidden' : 'visible';

            // Update next button text
            const isLastStep = currentStep === totalSteps - 1;
            const enText = isLastStep ? 'Get Started' : 'Next';
            const bnText = isLastStep ? 'শুরু করুন' : 'পরবর্তী';
            nextBtn.querySelector('.title-en').textContent = enText;
            nextBtn.querySelector('.title-bn').textContent = bnText;
        }

        function closeOnboarding() {
            modal.close();
            state.ui.hasSeenOnboarding = true;
            saveState();
        }

        skipBtn?.addEventListener('click', closeOnboarding);

        prevBtn?.addEventListener('click', () => {
            if (currentStep > 0) {
                currentStep--;
                updateSlide();
                playFeedback();
            }
        });

        nextBtn?.addEventListener('click', () => {
            if (currentStep < totalSteps - 1) {
                currentStep++;
                updateSlide();
                playFeedback();
            } else {
                closeOnboarding();
            }
        });

        dots.forEach((dot, i) => {
            dot.addEventListener('click', () => {
                currentStep = i;
                updateSlide();
                playFeedback();
            });
        });

        // Show onboarding on first visit (after a small delay to let app initialize)
        if (!state.ui.hasSeenOnboarding) {
            setTimeout(() => {
                modal.showModal();
            }, 500);
        }
    }

    function attachAuthHandlers() {
        selectors.authTabs?.forEach(tab => {
            tab.addEventListener('click', () => {
                setAuthMode(tab.dataset.mode);
            });
        });

        // Close button only works when already unlocked
        selectors.authCloseBtn?.addEventListener('click', () => {
            if (state.session.unlocked && state.auth.passwordHash) {
                selectors.authOverlay.hidden = true;
                document.body.classList.remove('locked');
            }
        });

        // Prevent clicking overlay background from doing anything
        selectors.authOverlay?.addEventListener('click', event => {
            if (event.target === selectors.authOverlay) {
                event.stopPropagation();
            }
        });

        // Prevent escape key from closing overlay when locked
        document.addEventListener('keydown', event => {
            if (event.key === 'Escape') {
                const needsAuth = !state.auth.passwordHash || !state.session.unlocked;
                if (needsAuth && selectors.authOverlay && !selectors.authOverlay.hidden) {
                    event.preventDefault();
                    event.stopPropagation();
                }
            }
        });

        selectors.authLoginForm?.addEventListener('submit', async event => {
            event.preventDefault();
            await handleAuthLogin(event);
        });

        selectors.authSetupForm?.addEventListener('submit', async event => {
            event.preventDefault();
            await handleAuthSetup(event);
        });

        // Profile picture upload with visual preview
        const profileInput = selectors.authSetupForm?.elements.profilePicture;
        profileInput?.addEventListener('change', async e => {
            const file = e.target.files?.[0];
            if (file && selectors.profileUploadPreview) {
                const url = await readFileAsDataUrl(file);
                selectors.profileUploadPreview.innerHTML = `<img src="${url}" alt="Profile">`;
                selectors.profileUploadPreview.classList.add('has-image');
            }
        });

        // Skip button - continue without password
        if (selectors.authSkipBtn) {
            console.log('Skip button found, attaching click handler');
            selectors.authSkipBtn.addEventListener('click', () => {
                console.log('Skip button clicked');
                skipAuth();
            });
        } else {
            console.warn('Skip button not found!');
        }

        document.querySelectorAll('[data-action="toggle-password"]').forEach(btn => {
            btn.addEventListener('click', () => togglePasswordInput(selectors.authLoginForm?.elements.password, btn));
        });
        document.querySelectorAll('[data-action="toggle-passcode"]').forEach(btn => {
            btn.addEventListener('click', () => togglePasswordInput(selectors.authLoginForm?.elements.passcode, btn));
        });
        document.querySelectorAll('[data-action="toggle-new-password"]').forEach(btn => {
            btn.addEventListener('click', () => togglePasswordInput(selectors.authSetupForm?.elements.password, btn));
        });
    }

    function skipAuth() {
        // Allow using app without password - mark as guest
        state.auth.isGuest = true;
        state.auth.name = state.auth.name || 'Guest';
        state.session.unlocked = true;
        saveState();
        renderAuthState();
        renderAll();
        playFeedback();
        console.log('Skip auth - guest mode activated');
    }

    function togglePasswordInput(input, button) {
        if (!input) return;
        const next = input.type === 'password' ? 'text' : 'password';
        input.type = next;
        if (button) {
            button.setAttribute('aria-label', next === 'text' ? 'Hide' : 'Show');
        }
    }

    function setAuthMode(mode) {
        const effectiveMode = state.auth.passwordHash ? mode : 'setup';
        selectors.authTabs?.forEach(tab => {
            const isActive = tab.dataset.mode === effectiveMode;
            tab.classList.toggle('active', isActive);
            tab.setAttribute('aria-selected', isActive ? 'true' : 'false');
        });
        selectors.authLoginForm?.classList.toggle('hidden', effectiveMode !== 'login');
        selectors.authSetupForm?.classList.toggle('hidden', effectiveMode !== 'setup');
    }

    function renderAuthState() {
        const overlay = selectors.authOverlay;
        if (!overlay) {
            console.warn('Auth overlay not found');
            return;
        }

        const isGuest = !!state.auth.isGuest;
        const hasPassword = !!state.auth.passwordHash;
        const isUnlocked = !!state.session.unlocked;

        console.log('renderAuthState:', { isGuest, hasPassword, isUnlocked });

        // Determine if we need to show auth screen
        // Show if: not a guest AND (no password set OR not unlocked)
        const needsSetup = !hasPassword && !isGuest;
        const needsLogin = hasPassword && !isUnlocked;
        const showAuth = needsSetup || needsLogin;

        console.log('Auth decision:', { needsSetup, needsLogin, showAuth });

        // Update overlay visibility
        if (showAuth) {
            overlay.hidden = false;
            overlay.removeAttribute('hidden');
            overlay.style.display = 'flex';
            console.log('Showing auth overlay');
        } else {
            overlay.hidden = true;
            overlay.setAttribute('hidden', '');
            overlay.style.display = 'none';
            console.log('Hiding auth overlay');
        }

        document.body.classList.toggle('locked', showAuth);
        setAuthMode(needsSetup ? 'setup' : 'login');

        if (selectors.authError) selectors.authError.textContent = '';

        // Hide close button when auth is required
        if (selectors.authCloseBtn) {
            selectors.authCloseBtn.hidden = showAuth;
        }

        // Show/hide lock button based on whether password is set
        if (selectors.lockBtn) {
            selectors.lockBtn.hidden = !hasPassword;
        }
        // Settings lock button removed

        // Clear form fields when showing login
        if (showAuth && !needsSetup) {
            selectors.authLoginForm?.reset();
        }

        updateUserBadge();
        updateThemePickerUI();
    }

    async function handleAuthLogin(event) {
        const data = new FormData(event.target);
        const password = (data.get('password') || '').toString();
        const passcode = (data.get('passcode') || '').toString();
        const passwordHash = password ? await hashString(password) : '';
        const passcodeHash = passcode ? await hashString(passcode) : '';
        const matchedPassword = passwordHash && passwordHash === state.auth.passwordHash;
        const matchedPasscode = passcodeHash && state.auth.passcodeHash && passcodeHash === state.auth.passcodeHash;
        if (matchedPassword || matchedPasscode) {
            selectors.authError.textContent = '';
            unlockSession();
        } else {
            selectors.authError.textContent = translate('auth.errorInvalid');
        }
    }

    async function handleAuthSetup(event) {
        console.log('handleAuthSetup called');
        const data = new FormData(event.target);
        const name = (data.get('name') || '').toString().trim();
        const email = (data.get('email') || '').toString().trim();
        const password = (data.get('password') || '').toString();
        const passcode = (data.get('passcode') || '').toString().trim();

        // Password is optional - if provided, must be at least 6 chars
        let passwordHash = '';
        let passcodeHash = '';
        if (password) {
            if (password.length < 6) {
                if (selectors.authError) {
                    selectors.authError.textContent = translate('auth.errorPasswordShort');
                }
                return;
            }
            passwordHash = await hashString(password);
            passcodeHash = passcode ? await hashString(passcode) : '';
        }

        const profilePicture = await readFileAsDataUrl(data.get('profilePicture'));

        state.auth = {
            name: name || 'Guest',
            email,
            passwordHash,
            passcodeHash,
            profilePicture,
            extraPhoto: '',
            createdAt: Date.now(),
            isGuest: !passwordHash
        };
        console.log('Auth setup complete, isGuest:', state.auth.isGuest);
        saveState();
        unlockSession();
        playFeedback();
    }

    async function hashString(value) {
        try {
            const encoder = new TextEncoder();
            const data = encoder.encode(value);
            const hashBuffer = await crypto.subtle.digest('SHA-256', data);
            const hashArray = Array.from(new Uint8Array(hashBuffer));
            return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
        } catch (error) {
            return btoa(value);
        }
    }

    async function readFileAsDataUrl(file) {
        return new Promise(resolve => {
            if (!file || !(file instanceof File)) return resolve('');
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result.toString());
            reader.onerror = () => resolve('');
            reader.readAsDataURL(file);
        });
    }

    function updateUserBadge() {
        const { userPill, userName, userEmail, userAvatar } = selectors;
        if (!userPill) return;
        const hasAuth = state.auth?.name || state.auth?.email || state.auth?.profilePicture;
        userPill.hidden = !hasAuth;
        if (!hasAuth) return;
        userName.textContent = state.auth.name || 'Debtx user';
        userEmail.textContent = state.auth.email || '';
        if (state.auth.profilePicture) {
            userAvatar.innerHTML = `<img src="${state.auth.profilePicture}" alt="">`;
        } else {
            userAvatar.textContent = (state.auth.name || 'D').slice(0, 1).toUpperCase();
        }
        renderSettingsProfile();
    }

    function renderSettingsProfile() {
        // Settings profile display removed
    }

    function updateSettingsToggles() {
        if (selectors.toggleHaptics) selectors.toggleHaptics.checked = !!state.ui.haptics;
        if (selectors.toggleSounds) selectors.toggleSounds.checked = !!state.ui.sounds;
    }

    function refreshAISummary(silent = false) {
        const text = buildAISummary();
        state.ai.lastSummary = text;
        if (selectors.aiSummaryText) selectors.aiSummaryText.textContent = text;
        saveState();
        if (!silent) playFeedback();
    }

    function buildAISummary() {
        const totalTasks = state.tasks.length;
        const doneTasks = state.tasks.filter(t => t.done).length;
        const overdueTasks = state.tasks.filter(t => !t.done && t.dueDate && daysUntil(t.dueDate) < 0).length;
        const dueToday = state.tasks.filter(t => !t.done && t.dueDate === todayString()).length;
        const notesCount = state.notes.length;
        const customersCount = state.customers.length;
        const overdueCustomers = state.customers.filter(c => getCustomerDueInfo(c).status === 'overdue').length;
        if (state.language === 'bn') {
            return [
                `কাজ: মোট ${totalTasks}টি · সম্পন্ন ${doneTasks}টি · বাকি ${overdueTasks}টি · আজকের ${dueToday}টি।`,
                `নোট: ${notesCount}টি সংরক্ষিত।`,
                `ক্রেতা: মোট ${customersCount}জন · বাকি থাকা ${overdueCustomers}জন।`
            ].join(' ');
        }
        return [
            `Tasks: ${totalTasks} total · ${doneTasks} done · ${overdueTasks} overdue · ${dueToday} due today.`,
            `Notes: ${notesCount} saved.`,
            `Customers: ${customersCount} tracked · ${overdueCustomers} overdue.`
        ].join(' ');
    }

    function openProfileModal() {
        if (!forms.profile || !modals.profile) return;
        forms.profile.reset();
        forms.profile.elements.name.value = state.auth?.name || '';
        forms.profile.elements.email.value = state.auth?.email || '';
        modals.profile.showModal();
    }

    async function handleProfileSubmit(event) {
        const data = new FormData(event.target);
        const name = (data.get('name') || '').toString().trim();
        const email = (data.get('email') || '').toString().trim();
        const profilePicture = await readFileAsDataUrl(data.get('profilePicture'));
        const extraPhoto = await readFileAsDataUrl(data.get('extraPhoto'));

        state.auth.name = name || state.auth.name;
        state.auth.email = email;
        if (profilePicture) state.auth.profilePicture = profilePicture;
        if (extraPhoto) state.auth.extraPhoto = extraPhoto;
        saveState();
        updateUserBadge();
        modals.profile?.close();
    }

    function applyTheme(theme, options = {}) {
        // All available themes - 7 new professional themes + legacy themes
        const allThemes = [
            // New professional themes
            'studio-pro',      // Crisp & premium
            'cozy-ledger',      // Warm & calming
            'clean-business',   // Minimal high-contrast
            'night-shop',       // Dark mode optimized
            'zen-finance',      // Peaceful pastels
            'street-ledger',    // Bold & modern
            'classic-paper',    // Traditional ledger
            // Legacy themes for backward compatibility
            'light', 'dark', 'ocean', 'rose'
        ];

        // Map old theme names to new themes
        const themeMap = {
            'default': 'studio-pro',
            'mint': 'cozy-ledger',
            'light': 'clean-business',
            'midnight': 'night-shop',
            'dark': 'night-shop',
            'sunset': 'street-ledger',
            'slate': 'zen-finance',
            'ocean': 'zen-finance',
            'forest': 'classic-paper',
            'neon': 'street-ledger',
            'graphite': 'night-shop',
            'lavender': 'zen-finance',
            'amber': 'cozy-ledger',
            'emerald': 'classic-paper',
            'rose': 'street-ledger',
            'sapphire': 'clean-business',
            'coral': 'street-ledger',
            'teal': 'zen-finance'
        };

        // Theme descriptions for UI
        const themeDescriptions = {
            'studio-pro': 'Crisp professional palette — refined neutrals with a premium teal focus.',
            'cozy-ledger': 'Warm, calming tones with soft shadows — designed to reduce stress during long daily use.',
            'clean-business': 'Minimal high-contrast layout — prioritizes clarity and speed for professional use.',
            'night-shop': 'Dark theme with eye-friendly highlights — perfect for night-time use.',
            'zen-finance': 'Peaceful pastel layout — feels spacious and organized for clear financial overview.',
            'street-ledger': 'Bold modern theme — highlights important actions with energetic colors.',
            'classic-paper': 'Paper-inspired design — feels familiar and reliable like a traditional ledger.'
        };

        let safe = theme;
        if (themeMap[theme]) {
            safe = themeMap[theme];
        } else if (!allThemes.includes(theme)) {
            safe = 'studio-pro'; // Default to studio-pro
        }

        state.ui.theme = safe;

        // Add transition class for smooth theme switching
        if (!options.initial) {
            document.documentElement.setAttribute('data-theme-transitioning', 'true');
            setTimeout(() => {
                document.documentElement.removeAttribute('data-theme-transitioning');
            }, 350);
        }

        // Apply theme immediately to document element
        if (document.documentElement) {
            document.documentElement.setAttribute('data-theme', safe);
        }

        // Update theme description in UI
        const descEl = document.querySelector('.theme-description-text');
        if (descEl && themeDescriptions[safe]) {
            descEl.textContent = themeDescriptions[safe];
        }

        // Update theme picker UI
        updateThemePickerUI();

        // Save state if not initial load
        if (!options.initial) {
            saveState();
        }
    }

    function updateThemePickerUI() {
        // Update old theme grid if it exists
        const grid = selectors.themeGrid;
        if (grid) {
            grid.querySelectorAll('[data-theme]').forEach(btn => {
                const isActive = btn.dataset.theme === state.ui.theme;
                btn.setAttribute('aria-checked', isActive ? 'true' : 'false');
                if (isActive) {
                    btn.classList.add('active');
                } else {
                    btn.classList.remove('active');
                }
            });
        }

        // Update settings panel theme tiles
        document.querySelectorAll('.theme-appearance-tile').forEach(tile => {
            const isActive = tile.dataset.theme === state.ui.theme;
            tile.setAttribute('aria-checked', isActive ? 'true' : 'false');
            if (isActive) {
                tile.classList.add('active');
            } else {
                tile.classList.remove('active');
            }
        });
    }

    function lockSession() {
        state.session.unlocked = false;
        saveState();
        renderAuthState();
    }

    function unlockSession() {
        console.log('Unlocking session...');
        state.session.unlocked = true;
        saveState();
        renderAuthState();
        renderAll();
        console.log('Session unlocked, auth state rendered');
    }

    function playFeedback() {
        if (state.ui.haptics && 'vibrate' in navigator) {
            navigator.vibrate(12);
        }
        if (state.ui.sounds) {
            playUISound();
        }
    }

    function playFeedbackStrong() {
        if (state.ui.haptics && 'vibrate' in navigator) {
            navigator.vibrate([10, 60, 10]);
        }
        if (state.ui.sounds) playUISound();
    }

    let uiAudio;
    function playUISound() {
        try {
            if (!uiAudio) {
                uiAudio = new Audio('data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAESsAACJWAAACABAAZGF0YQAAAAA=');
            }
            uiAudio.currentTime = 0;
            uiAudio.play();
        } catch (error) {
            // ignore sound failures
        }
    }

    function registerServiceWorker() {
        if (!('serviceWorker' in navigator)) return;
        window.addEventListener('load', () => {
            navigator.serviceWorker
                .register('sw.js')
                .catch(error => console.error('Service worker registration failed', error));
        });
    }

    function updateDockActiveState(panel) {
        const customersTab = state.ui.customersTab || 'customers';
        const notesTab = state.ui.activeNotesTab || 'notes';
        Object.entries(selectors.nav).forEach(([key, btn]) => {
            if (!btn) return;
            let isActive = key === panel;
            if (key === 'customers') {
                isActive = panel === 'customers';
            } else if (key === 'tasks') {
                isActive = panel === 'notes' && notesTab === 'tasks';
            } else if (key === 'notes') {
                isActive = panel === 'notes' && notesTab !== 'tasks';
            }
            btn.classList.toggle('active', isActive);
        });
    }

    function setActivePanel(panel) {
        if (!selectors.panels[panel]) {
            panel = 'customers';
        }
        state.ui.activePanel = panel;
        Object.entries(selectors.panels).forEach(([key, panelEl]) => {
            if (!panelEl) return;
            panelEl.classList.toggle('active', key === panel);
        });


        if (panel === 'customers') {
            setCustomersTab(state.ui.customersTab || 'customers', { save: false });
        }

        // Re-render tasks when notes panel is shown
        if (panel === 'notes') {
            renderTasks();
            renderNewTodoList(getCurrentTodoCategory());
            updateTodoStats();
        }

        // Update settings display when settings panel is shown
        if (panel === 'settings') {
            setTimeout(() => {
                updateSettingsDisplay();
                updateNewSettingsUI();
            }, 100);
        }

        // Update premium panel status when shown
        if (panel === 'premium') {
            updatePremiumPanelStatus();
            setBillingMode(state.ui.pricingBilling || 'annual');
            highlightPlanCards();
        }
        if (panel === 'ai') {
            ensureAIChatAccessible();
        }
        updateDockActiveState(panel);

        saveState();
    }

    // Update dock premium button visibility based on subscription
    function updateDockPremiumVisibility() {
        const premiumBtn = document.getElementById('nav-premium');
        const cornerBtn = selectors.premiumCornerBtn;
        const isFree = getActivePlan() === 'free';

        if (premiumBtn) {
            premiumBtn.hidden = !isFree;
            premiumBtn.setAttribute('aria-hidden', isFree ? 'false' : 'true');
            premiumBtn.classList.toggle('hidden', !isFree);
        }
        if (cornerBtn) {
            cornerBtn.hidden = !isFree;
            cornerBtn.setAttribute('aria-hidden', isFree ? 'false' : 'true');
        }
    }

    function openAIPaywallModal() {
        const modal = document.getElementById('ai-paywall-modal');
        if (!modal) return;
        if (typeof modal.showModal === 'function') {
            modal.showModal();
        } else {
            modal.setAttribute('open', 'true');
        }
    }

    // Update premium panel status display
    function updatePremiumPanelStatus() {
        const statusEl = document.getElementById('premium-current-status');
        if (!statusEl) return;

        const activePlan = getActivePlan();
        const sub = state.subscription || { plan: 'free' };
        const now = Date.now();
        const expiresAt = sub.expiresAt && sub.expiresAt > now ? sub.expiresAt : null;
        const daysLeft = expiresAt ? Math.max(0, Math.ceil((expiresAt - now) / (24 * 60 * 60 * 1000))) : null;
        const isBangla = state.language === 'bn';
        const planNames = {
            free: isBangla ? 'ফ্রি' : 'Free',
            nano: isBangla ? 'ন্যানো' : 'Nano',
            pro: isBangla ? 'প্রো' : 'Pro',
            max: isBangla ? 'ম্যাক্স' : 'Max',
            ultra: isBangla ? 'আল্ট্রা' : 'Ultra',
            agentic_ultra: isBangla ? 'এজেন্টিক আল্ট্রা' : 'Agentic Ultra'
        };

        const planEl = document.getElementById('premium-current-plan');
        const usageEl = document.getElementById('premium-current-usage');
        const hintEl = document.getElementById('premium-current-hint');
        const daysEl = document.getElementById('premium-days-left');

        if (planEl) planEl.textContent = planNames[activePlan] || planNames.free;
        if (daysEl) {
            if (!expiresAt || activePlan === 'free') {
                daysEl.textContent = '—';
            } else {
                daysEl.textContent = String(daysLeft);
            }
        }
        if (usageEl) {
            const usageText = (() => {
                switch (activePlan) {
                    case 'free':
                        return isBangla ? 'এআই এজেন্ট: ২০/মাস' : 'AI agent: 20/month';
                    case 'nano':
                        return isBangla ? 'এআই এজেন্ট: ৫/দিন' : 'AI agent: 5/day';
                    case 'pro':
                        return isBangla ? 'এআই এজেন্ট: ১০০/মাস' : 'AI agent: 100/month';
                    case 'max':
                        return isBangla ? 'এআই এজেন্ট: ১০০/বছর' : 'AI agent: 100/year';
                    case 'ultra':
                        return isBangla ? 'এআই এজেন্ট: ২০০/বছর' : 'AI agent: 200/year';
                    case 'agentic_ultra':
                        return isBangla ? 'এআই এজেন্ট: ১০০০/বছর বা ২০০/মাস' : 'AI agent: 1000/year or 200/month';
                    default:
                        return isBangla ? 'এআই এজেন্ট: ২০/মাস' : 'AI agent: 20/month';
                }
            })();
            usageEl.textContent = usageText;
        }
        if (hintEl) {
            if (!expiresAt || activePlan === 'free') {
                hintEl.textContent = isBangla
                    ? 'কুপন রিডিম করে প্ল্যান চালু করুন।'
                    : 'Redeem a coupon to activate a plan.';
            } else {
                const expiryDate = new Date(expiresAt);
                const dateStr = expiryDate.toLocaleDateString(isBangla ? 'bn-BD' : 'en-US');
                hintEl.textContent = isBangla
                    ? `মেয়াদ শেষ হতে বাকি: ${daysLeft} দিন • মেয়াদ শেষ: ${dateStr}`
                    : `Days left: ${daysLeft} • Expires: ${dateStr}`;
            }
        }
        highlightPlanCards();
    }

    function bindCancelSubscriptionButton(btn) {
        if (!btn || btn.dataset.bound) return;
        btn.dataset.bound = '1';

        btn.addEventListener('click', () => {
            const isBangla = state.language === 'bn';
            const activePlan = getActivePlan();

            if (activePlan === 'free') {
                alert(isBangla
                    ? 'আপনি ফ্রি প্ল্যানে আছেন। বাতিল করার মতো কোনো সক্রিয় সাবস্ক্রিপশন নেই।'
                    : 'You are already on the Free plan—there is no active subscription to cancel.');
                return;
            }

            const ok = confirm(isBangla
                ? 'সাবস্ক্রিপশন বাতিল করলে আপনি ফ্রি প্ল্যানে চলে যাবেন। চালিয়ে যেতে চান?'
                : 'Cancel your subscription now? You will move back to the Free plan.');

            if (ok) {
                cancelSubscription(false);
                alert(isBangla
                    ? 'সাবস্ক্রিপশন বাতিল হয়েছে। আপনি এখন ফ্রি প্ল্যানে।'
                    : 'Subscription cancelled. You are now on the Free plan.');
            }
        });
    }

    function updateSettingsSubscriptionOverview() {
        const planEls = Array.from(document.querySelectorAll('#settings-current-plan'));
        const daysEls = Array.from(document.querySelectorAll('#settings-days-left'));
        const noteEls = Array.from(document.querySelectorAll('#settings-expiry-note'));
        const renewBoxEls = Array.from(document.querySelectorAll('#settings-renew-box'));
        const renewTitleEls = Array.from(document.querySelectorAll('#settings-renew-title'));
        const renewValueEls = Array.from(document.querySelectorAll('#settings-renew-value'));
        const renewSubEls = Array.from(document.querySelectorAll('#settings-renew-sub'));
        if (planEls.length === 0 && daysEls.length === 0 && noteEls.length === 0) return;

        const activePlan = getActivePlan();
        const isBangla = state.language === 'bn';
        const planNames = {
            free: isBangla ? 'ফ্রি' : 'Free',
            nano: isBangla ? 'ন্যানো' : 'Nano',
            pro: isBangla ? 'প্রো' : 'Pro',
            max: isBangla ? 'ম্যাক্স' : 'Max',
            ultra: isBangla ? 'আল্ট্রা' : 'Ultra',
            agentic_ultra: isBangla ? 'এজেন্টিক আল্ট্রা' : 'Agentic Ultra'
        };

        const sub = state.subscription || { plan: 'free' };
        const now = Date.now();
        const expiresAt = sub.expiresAt && sub.expiresAt > now ? sub.expiresAt : null;
        let daysLeft = 0;
        if (expiresAt) {
            daysLeft = Math.ceil((expiresAt - now) / (24 * 60 * 60 * 1000));
        }

        planEls.forEach(el => { el.textContent = planNames[activePlan] || planNames.free; });
        daysEls.forEach(el => {
            el.textContent = !expiresAt || activePlan === 'free' ? (isBangla ? 'আজীবন' : 'Lifetime') : String(daysLeft);
        });

        renewBoxEls.forEach(el => {
            if (!expiresAt || activePlan === 'free') {
                el.hidden = true;
            } else {
                el.hidden = false;
            }
        });
        if (expiresAt && activePlan !== 'free') {
            const expiryDate = new Date(expiresAt);
            const dateStr = expiryDate.toLocaleDateString(isBangla ? 'bn-BD' : 'en-US');
            renewTitleEls.forEach(el => { el.textContent = isBangla ? 'রিনিউ হতে বাকি' : 'Renews in'; });
            renewValueEls.forEach(el => { el.textContent = isBangla ? `${daysLeft} দিন` : `${daysLeft} days`; });
            renewSubEls.forEach(el => { el.textContent = isBangla ? `রিনিউ তারিখ: ${dateStr}` : `Renew date: ${dateStr}`; });
        }

        noteEls.forEach(el => {
            if (!expiresAt || activePlan === 'free') {
                el.textContent = isBangla
                    ? 'আপনার বর্তমান প্ল্যানে কোনো মেয়াদ নেই।'
                    : 'No expiration date for your current plan.';
            } else {
                const expiryDate = new Date(expiresAt);
                const dateStr = expiryDate.toLocaleDateString(isBangla ? 'bn-BD' : 'en-US');
                el.textContent = isBangla
                    ? `মেয়াদ শেষ: ${dateStr} • রিনিউ করার জন্য ফেসবুকে মেসেজ দিন।`
                    : `Expires: ${dateStr} • Message us on Facebook to renew.`;
            }
        });

        const cancelBtns = Array.from(document.querySelectorAll('#settings-cancel-sub-btn'));
        cancelBtns.forEach(btn => {
            const currentPlan = getActivePlan();
            if (currentPlan === 'free') {
                btn.hidden = true;
                btn.disabled = true;
                btn.setAttribute('aria-disabled', 'true');
            } else {
                btn.hidden = false;
                btn.disabled = false;
                btn.setAttribute('aria-disabled', 'false');
                btn.textContent = isBangla ? 'সাবস্ক্রিপশন বাতিল করুন' : 'Cancel subscription';
                bindCancelSubscriptionButton(btn);
            }
        });
    }

    function cancelSubscription(showFeedback = true) {
        state.subscription = {
            plan: 'free',
            activatedAt: null,
            expiresAt: null,
            couponUsed: null
        };
        saveState();
        playFeedback();
        applyPlanBranding();
        if (typeof updatePremiumStatus === 'function') updatePremiumStatus();
        updatePremiumPanelStatus();
        updateSettingsSubscriptionOverview();
        updateNewSettingsUI();
        ensureAIChatAccessible();
        updateDockPremiumVisibility();
        if (typeof highlightPlanCards === 'function') highlightPlanCards();

        if (showFeedback) {
            alert(state.language === 'bn'
                ? 'সাবস্ক্রিপশন বাতিল হয়েছে। আপনি এখন ফ্রি প্ল্যানে।'
                : 'Subscription cancelled. You are now on the Free plan.');
        }
    }

    function normalizePlan(plan) {
        if (plan === 'agentic_ultra') return 'agentic_ultra';
        if (plan === 'ultra') return 'ultra';
        if (plan === 'max') return 'max';
        if (plan === 'pro') return 'pro';
        if (plan === 'nano') return 'nano';
        return 'free';
    }

    // Get active subscription plan (handles expiry + legacy plans)
    function getActivePlan() {
        const sub = state.subscription || { plan: 'free' };
        const now = Date.now();
        if (sub.expiresAt && now > sub.expiresAt) return 'free';
        return normalizePlan(sub.plan || 'free');
    }

    // Apply DebtX plan branding: header logo, body data-attr, and settings plan section. free=black, pro/max=red, ultra=purple.
    function applyPlanBranding() {
        const plan = getActivePlan();
        document.body.dataset.debtxPlan = plan;

        const section = document.getElementById('settings-plan-section');
        const badge = document.getElementById('settings-plan-badge');
        const nameEl = document.getElementById('settings-debtx-name');
        if (section) {
            section.classList.remove('plan-free', 'plan-nano', 'plan-pro', 'plan-max', 'plan-ultra');
            section.classList.add('plan-' + plan);
        }
        const planLabels = {
            free: state.language === 'bn' ? 'ফ্রি' : 'Free',
            nano: state.language === 'bn' ? 'ন্যানো' : 'Nano',
            pro: state.language === 'bn' ? 'প্রো' : 'Pro',
            max: state.language === 'bn' ? 'ম্যাক্স' : 'Max',
            ultra: state.language === 'bn' ? 'আল্ট্রা' : 'Ultra',
            agentic_ultra: state.language === 'bn' ? 'এজেন্টিক আল্ট্রা' : 'Agentic Ultra'
        };
        if (badge) badge.textContent = planLabels[plan] || planLabels.free;
        if (nameEl) nameEl.textContent = 'DebtX';
    }

    function highlightPlanCards() {
        const activePlan = getActivePlan();
        document.querySelectorAll('[data-plan-card]').forEach(card => {
            card.classList.toggle('is-active', card.dataset.planCard === activePlan);
        });
    }

    function setBillingMode(mode = 'annual') {
        const normalized = mode === 'monthly' ? 'monthly' : 'annual';
        state.ui.pricingBilling = normalized;
        const stack = document.getElementById('pricing-card-stack');
        const cards = stack ? stack.querySelectorAll('[data-billing]') : [];
        cards.forEach(card => {
            const billing = card.dataset.billing || 'all';
            const show = billing === 'all' || billing === normalized;
            card.hidden = !show;
            card.classList.toggle('is-visible', show);
        });
        document.querySelectorAll('[data-billing-toggle]').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.billingToggle === normalized);
        });
        if (stack) stack.dataset.activeBilling = normalized;

        // Keep Agentic Ultra pricing in sync with the billing toggle (monthly vs annual).
        const agenticCard = stack?.querySelector('[data-plan-card="agentic_ultra"]');
        if (agenticCard) {
            const monthlyPrice = agenticCard.dataset.priceMonthly;
            const annualPrice = agenticCard.dataset.priceAnnual;
            const priceEl = agenticCard.querySelector('[data-agentic-ultra-price]');
            const periodEl = agenticCard.querySelector('[data-agentic-ultra-period]');
            const altEl = agenticCard.querySelector('[data-agentic-ultra-alt]');
            if (normalized === 'monthly') {
                if (priceEl && monthlyPrice) priceEl.textContent = `৳${monthlyPrice}`;
                if (periodEl) periodEl.textContent = '/month';
                if (altEl && annualPrice) altEl.textContent = `৳${annualPrice}/year`;
            } else {
                if (priceEl && annualPrice) priceEl.textContent = `৳${annualPrice}`;
                if (periodEl) periodEl.textContent = '/year';
                if (altEl && monthlyPrice) altEl.textContent = `৳${monthlyPrice}/month`;
            }
        }

        saveState();
    }

    function handlePlanSelect(plan, billingMode) {
        const normalized = normalizePlan(plan);
        state.subscription.plan = normalized;
        state.subscription.activatedAt = Date.now();
        state.subscription.expiresAt = null;
        if (billingMode) {
            state.ui.pricingBilling = billingMode === 'monthly' ? 'monthly' : 'annual';
        }
        saveState();
        applyPlanBranding();
        updatePremiumPanelStatus();
        highlightPlanCards();
    }

    // Update new settings UI elements
    function updateNewSettingsUI() {
        applyPlanBranding();
        highlightPlanCards();
        updateSettingsSubscriptionOverview();
        updateProChatUsageUI();
        // Update language buttons
        const langBtns = document.querySelectorAll('.lang-btn-new');
        langBtns.forEach(btn => {
            btn.classList.toggle('active', btn.dataset.lang === state.language);
        });

        // Update text size buttons
        const sizeBtns = document.querySelectorAll('.size-btn-new');
        sizeBtns.forEach(btn => {
            btn.classList.toggle('active', parseInt(btn.dataset.size) === state.ui.textSize);
        });

        // Update view mode buttons
        const viewBtns = document.querySelectorAll('.view-btn-new');
        viewBtns.forEach(btn => {
            btn.classList.toggle('active', btn.dataset.view === (state.ui.viewMode || 'phone'));
        });

        if (selectors.uiScaleInput) {
            selectors.uiScaleInput.value = Math.max(0.8, Math.min(1.0, Number(state.ui.uiScale) || 1));
        }
        updateUiScaleDisplay();

        if (selectors.simpleTodoToggle) {
            selectors.simpleTodoToggle.checked = !!state.ui.simpleTodo;
        }

        // Update theme tiles
        const themeTiles = document.querySelectorAll('.theme-tile-new');
        themeTiles.forEach(tile => {
            tile.setAttribute('aria-checked', tile.dataset.theme === state.ui.theme ? 'true' : 'false');
        });
    }

    // Get customer limit based on subscription
    function getCustomerLimit() {
        const subscription = state.subscription || { plan: 'free' };
        const now = Date.now();
        const isExpired = subscription.expiresAt && now > subscription.expiresAt;
        const activePlan = (isExpired ? 'free' : subscription.plan) || 'free';

        switch (activePlan) {
            case 'free':
                return Infinity; // Unlimited for free
            case 'max':
            case 'ultra':
                return Infinity; // Unlimited for other plans
            default:
                return Infinity;
        }
    }

    function setModalMode(form, mode) {
        form.dataset.mode = mode;
    }

    function handleCustomerSubmit(event) {
        event.preventDefault();

        try {
            const form = event.target;
            const data = new FormData(form);
            const customerName = data.get('name')?.trim();

            // Validate customer name
            if (!customerName) {
                alert(state.language === 'bn' ? 'ক্রেতার নাম প্রয়োজন' : 'Customer name is required');
                return;
            }

            // Customer limit
            const activePlan = getActivePlan();
            let limit = 5; // free
            if (activePlan === 'nano') limit = 20;
            else if (activePlan === 'pro') limit = 100;
            else if (activePlan === 'max') limit = 200;
            else if (activePlan === 'ultra') limit = Infinity;

            if (state.customers.length >= limit) {
                const msg = state.language === 'bn'
                    ? `আপনার ${activePlan} প্ল্যানের সীমা (${limit} ক্রেতা) পূর্ণ হয়েছে। আরও ক্রেতা যোগ করতে আপগ্রেড করুন।`
                    : `Your ${activePlan} plan limit (${limit} customers) has been reached. Upgrade to add more.`;
                alert(msg);
                return;
            }

            // Process customer addition
            const customer = {
                id: generateId('cust'),
                name: customerName,
                phone: (data.get('phone') || '').trim(),
                repaymentDays: clampNumber(parseInt(data.get('repaymentDays'), 10) || 7, 1, 90),
                note: (data.get('note') || '').trim()
            };
            customer.createdAt = Date.now();
            customer.updatedAt = Date.now();
            customer.debts = [];
            customer.payments = [];
            customer.history = [];
            customer.lastPaymentAt = null;

            state.customers.push(customer);
            saveState();
            renderCustomers();
            renderDebtLedger();
            renderAIDebtCalendar();
            populateCardCustomerSelect();
            modals.customer.close();

        } catch (error) {
            console.error('Error in handleCustomerSubmit:', error);
            alert(state.language === 'bn' ? 'ক্রেতা যোগ করতে ত্রুটি হয়েছে' : 'Error adding customer: ' + error.message);
        }
    }

    function handleDebtSubmit(event) {
        event.preventDefault();
        const form = event.target;
        const data = new FormData(form);
        const customerId = data.get('customerId');
        const customer = state.customers.find(c => c.id === customerId);
        if (!customer) return;

        const amount = Math.max(0, Number(data.get('amount')) || 0);
        if (amount <= 0) return;

        const date = data.get('date') || todayString();
        const description = (data.get('description') || '').trim();

        const debtRecord = {
            id: generateId('debt'),
            amount,
            paidAmount: 0,
            date,
            description,
            dueDate: computeDueDate(date, customer.repaymentDays),
            reminders: { dueToday: false, overdue: false }
        };

        customer.debts.push(debtRecord);
        customer.history.push({
            id: generateId('hist'),
            type: 'debt',
            amount,
            date,
            description
        });
        customer.updatedAt = Date.now();
        saveState();
        renderCustomers();
        renderDebtLedger();
        renderAIDebtCalendar();
        renderTasks();
        modals.debt.close();
    }

    function handlePaymentSubmit(event) {
        event.preventDefault();
        const form = event.target;
        const data = new FormData(form);
        const customerId = data.get('customerId');
        const customer = state.customers.find(c => c.id === customerId);
        if (!customer) return;

        const amount = Math.max(0, Number(data.get('amount')) || 0);
        if (amount <= 0) return;

        const date = data.get('date') || todayString();
        const note = (data.get('note') || '').trim();

        const paymentRecord = {
            id: generateId('pay'),
            amount,
            date,
            note
        };

        applyPaymentToDebts(customer, amount);
        customer.payments.push(paymentRecord);
        customer.lastPaymentAt = date;
        customer.history.push({
            id: generateId('hist'),
            type: 'payment',
            amount,
            date,
            description: note
        });
        customer.updatedAt = Date.now();
        saveState();
        renderCustomers();
        renderDebtLedger();
        renderAIDebtCalendar();
        renderTasks();
        modals.payment.close();
    }

    function handleNoteSubmit(event) {
        event.preventDefault();
        const form = event.target;
        const data = new FormData(form);
        const noteId = data.get('noteId');
        const payload = {
            title: data.get('title').trim(),
            body: (data.get('body') || '').trim(),
            color: data.get('color') || 'yellow',
            pinned: !!data.get('pinned'),
            updatedAt: Date.now()
        };

        if (noteId) {
            const existing = state.notes.find(n => n.id === noteId);
            if (existing) {
                Object.assign(existing, payload);
            }
        } else {
            state.notes.unshift({
                id: generateId('note'),
                createdAt: Date.now(),
                ...payload
            });
        }
        saveState();
        renderNotes();
        modals.note.close();
        playFeedback();
    }

    function handleTaskSubmit(event) {
        event.preventDefault();
        const form = event.target;
        const data = new FormData(form);
        const taskId = data.get('taskId');

        const taskData = {
            name: data.get('name').trim(),
            type: data.get('type'),
            priority: data.get('priority') || 'medium',
            dueDate: data.get('dueDate') || todayString(),
            dueTime: data.get('dueTime') || '',
            note: (data.get('note') || '').trim(),
            recurring: data.get('recurring') === 'on',
            recurringType: data.get('recurringType') || 'daily',
            done: false,
            reminderSent: false
        };

        if (taskId) {
            // Edit existing task
            const existing = state.tasks.find(t => t.id === taskId);
            if (existing) {
                Object.assign(existing, taskData);
                existing.updatedAt = Date.now();
            }
        } else {
            // Create new task
            const task = {
                id: generateId('task'),
                ...taskData,
                createdAt: Date.now()
            };
            state.tasks.push(task);
        }

        saveState();
        renderTasks();
        modals.task.close();

        // Return to categories view if in detail view
        const categoriesView = document.getElementById('todo-categories-view');
        const detailView = document.getElementById('todo-detail-view');
        if (categoriesView && detailView && !detailView.hidden) {
            categoriesView.hidden = false;
            detailView.hidden = true;
        }

        playFeedback();
    }

    async function handleDemandSubmit(event) {
        event.preventDefault();
        const form = event.target;
        const data = new FormData(form);
        const customerId = data.get('customerId');
        const customer = state.customers.find(c => c.id === customerId);
        if (!customer) return;

        const amount = Math.max(1, Number(data.get('amount')) || 0);
        const dueDate = data.get('dueDate') || todayString();
        const paymentMethod = (data.get('paymentMethod') || '').trim();
        const note = (data.get('note') || '').trim();

        const cardUrl = await generateDemandCard(customer, {
            amount,
            dueDate,
            paymentMethod,
            note
        });
        lastDemandCardUrl = cardUrl;
        if (selectors.demandPreviewImg) selectors.demandPreviewImg.src = cardUrl;
        if (selectors.demandDownloadBtn) {
            selectors.demandDownloadBtn.href = cardUrl;
            selectors.demandDownloadBtn.removeAttribute('disabled');
        }
        selectors.demandShareBtn?.removeAttribute('disabled');
        selectors.demandPreviewText?.setAttribute('hidden', 'hidden');

        const shareText = `${customer.name} — ${formatCurrency(amount)}${dueDate ? ` · ${formatDisplayDate(dueDate)}` : ''}${paymentMethod ? ` · ${paymentMethod}` : ''}${note ? ` — ${note}` : ''}`;
        if (selectors.demandShareBtn) {
            selectors.demandShareBtn.onclick = () => shareDemandCard(cardUrl, shareText);
        }

        customer.history.push({
            id: generateId('hist'),
            type: 'demand',
            amount,
            date: dueDate,
            description: note || paymentMethod
        });
        customer.updatedAt = Date.now();
        saveState();
        renderCustomers();
    }

    function applyPaymentToDebts(customer, paymentAmount) {
        let remaining = paymentAmount;
        const outstandingDebts = (customer.debts || [])
            .map(debt => normalizeDebtRecord(debt, customer))
            .filter(Boolean)
            .sort((a, b) => new Date(a.date || 0) - new Date(b.date || 0));
        for (const debt of outstandingDebts) {
            const debtRemaining = Math.max(0, debt.amount - (debt.paidAmount || 0));
            if (debtRemaining <= 0) continue;
            const applied = Math.min(debtRemaining, remaining);
            debt.paidAmount = roundMoney((debt.paidAmount || 0) + applied);
            if (applied > 0) {
                remaining = roundMoney(remaining - applied);
            }
            if (remaining <= 0) break;
        }
        if (remaining > 0) {
            // Optional: keep record of extra payment
        }
        customer.debts.forEach(debt => {
            if (getDebtOutstanding(debt) <= 0) {
                debt.reminders = { dueToday: false, overdue: false };
            }
        });
    }

    function renderAll() {
        renderCustomers();
        renderDebtLedger();
        renderAIDebtCalendar();
        renderBills();
        renderNotes();
        renderTasks();
        renderCalendar();
        updateNotificationToggle();
        updateSettingsToggles();
        // Shop profile display removed with settings panel
        refreshAISummary(true);

        // Initialize notes/tasks tab
        if (state.ui.activeNotesTab) {
            switchNotesTab(state.ui.activeNotesTab);
        } else {
            switchNotesTab('notes');
        }
    }

    function renderCustomers() {
        const { customerList, customersEmpty, customerSearch } = selectors;
        if (!customerList) return;

        customerList.innerHTML = '';
        const query = (customerSearch?.value || '').trim().toLowerCase();

        const sortedCustomers = [...state.customers].sort((a, b) => b.updatedAt - a.updatedAt);
        const filteredCustomers = sortedCustomers.filter(customer => {
            if (!query) return true;
            return (
                customer.name.toLowerCase().includes(query) ||
                (customer.phone && customer.phone.toLowerCase().includes(query))
            );
        });

        if (filteredCustomers.length === 0) {
            if (customersEmpty) {
                const message = customersEmpty.querySelector('p');
                if (message) {
                    message.textContent = query ? translate('customers.emptySearch') : translate('customers.empty');
                }
                customersEmpty.removeAttribute('hidden');
            }
            return;
        }

        if (customersEmpty) {
            const message = customersEmpty.querySelector('p');
            if (message) {
                message.textContent = translate('customers.empty');
            }
            customersEmpty.setAttribute('hidden', 'hidden');
        }

        filteredCustomers.forEach(customer => {
            const fragment = document.importNode(templates.customerCard.content, true);
            localizeFragment(fragment);
            const card = fragment.querySelector('.customer-card');
            card.dataset.customerId = customer.id;

            const balanceEl = card.querySelector('.customer-balance');
            const nameEl = card.querySelector('.customer-name');
            const phoneEl = card.querySelector('.customer-phone');
            const lastPaymentEl = card.querySelector('.customer-last-payment');
            const dueDateEl = card.querySelector('.customer-due-date');
            const trustRatioEl = card.querySelector('.customer-trust-ratio');
            const noteEl = card.querySelector('.customer-note');
            const statusPill = card.querySelector('.status-pill');
            const statusText = card.querySelector('.status-text');

            const balance = getCustomerBalance(customer);
            const dueInfo = getCustomerDueInfo(customer);

            nameEl.textContent = customer.name;
            phoneEl.textContent = customer.phone || '\u2014';
            balanceEl.textContent = formatCurrency(balance);
            lastPaymentEl.textContent = customer.lastPaymentAt
                ? formatDisplayDate(customer.lastPaymentAt)
                : '\u2014';
            dueDateEl.textContent = dueInfo.nextDueDate
                ? formatDisplayDate(dueInfo.nextDueDate)
                : '\u2014';
            const trustRatio = calculateTrustRatio(customer);
            trustRatioEl.textContent = trustRatio + '%';
            noteEl.textContent = customer.note || '';
            noteEl.hidden = !customer.note;

            const status = dueInfo.status;
            statusText.textContent = translateStatus(status);
            const pillColor = status === 'overdue'
                ? 'var(--danger)'
                : status === 'dueSoon'
                    ? 'var(--accent)'
                    : status === 'settled'
                        ? 'var(--success)'
                        : 'var(--primary)';
            statusPill.style.background = pillColor;

            const historyList = card.querySelector('.history-list');
            const history = [...customer.history].sort((a, b) => new Date(b.date) - new Date(a.date));
            historyList.innerHTML = '';
            history.forEach(entry => {
                const li = document.createElement('li');
                li.textContent = buildHistoryEntry(entry, customer);
                historyList.appendChild(li);
            });

            card.querySelector('[data-action="history"]').addEventListener('click', () => {
                const historySection = card.querySelector('.customer-history');
                historySection.hidden = !historySection.hidden;
            });

            card.querySelector('[data-action="payment"]').addEventListener('click', () => {
                preparePaymentModal(customer);
            });

            card.querySelector('[data-action="demand"]').addEventListener('click', () => {
                prepareDemandModal(customer);
            });

            card.querySelector('[data-action="debt"]').addEventListener('click', () => {
                prepareDebtModal(customer);
            });

            card.querySelector('[data-action="delete"]').addEventListener('click', () => {
                deleteCustomer(customer.id);
            });

            customerList.appendChild(fragment);
        });
    }

    function deleteCustomer(customerId) {
        const customer = state.customers.find(c => c.id === customerId);
        if (!customer) return;

        const customerName = customer.name || 'this customer';
        const confirmMessage = state.language === 'bn'
            ? `আপনি কি নিশ্চিত যে আপনি "${customerName}" কে মুছে ফেলতে চান?\n\nএই ক্রেতার সব ডেটা (ঋণ, পেমেন্ট, ইতিহাস) চিরতরে মুছে যাবে।`
            : `Are you sure you want to delete "${customerName}"?\n\nAll customer data (debts, payments, history) will be permanently deleted.`;

        if (!confirm(confirmMessage)) {
            return;
        }

        // Remove customer from state
        const customerIndex = state.customers.findIndex(c => c.id === customerId);
        if (customerIndex !== -1) {
            state.customers.splice(customerIndex, 1);
            saveState();
            renderCustomers();
            renderDebtLedger();
            renderAIDebtCalendar();
            populateCardCustomerSelect();

            // Show success message
            const successMessage = state.language === 'bn'
                ? 'ক্রেতা সফলভাবে মুছে ফেলা হয়েছে'
                : 'Customer deleted successfully';

            // Optional: Show a toast notification or simple alert
            playFeedback();
        }
    }

    function buildDebtLedgerEntries() {
        const entries = [];
        state.customers.forEach(customer => {
            (customer.debts || []).forEach(debt => {
                const normalized = normalizeDebtRecord(debt, customer);
                if (!normalized) return;
                entries.push({
                    id: normalized.id,
                    customer,
                    debt: normalized,
                    outstanding: getDebtOutstanding(normalized),
                    status: getDebtStatus(normalized)
                });
            });
        });
        return entries;
    }

    function updateDebtSummary(entries) {
        let totalOutstanding = 0;
        let totalDueSoon = 0;
        let totalOverdue = 0;
        let totalSettled = 0;

        entries.forEach(entry => {
            if (entry.status === 'settled') {
                totalSettled += entry.debt.amount || 0;
                return;
            }
            totalOutstanding += entry.outstanding;
            if (entry.status === 'dueSoon') totalDueSoon += entry.outstanding;
            if (entry.status === 'overdue') totalOverdue += entry.outstanding;
        });

        const totalOutstandingEl = document.getElementById('debt-total-outstanding');
        const totalDueSoonEl = document.getElementById('debt-total-due-soon');
        const totalOverdueEl = document.getElementById('debt-total-overdue');
        const totalSettledEl = document.getElementById('debt-total-settled');

        if (totalOutstandingEl) totalOutstandingEl.textContent = formatCurrency(totalOutstanding);
        if (totalDueSoonEl) totalDueSoonEl.textContent = formatCurrency(totalDueSoon);
        if (totalOverdueEl) totalOverdueEl.textContent = formatCurrency(totalOverdue);
        if (totalSettledEl) totalSettledEl.textContent = formatCurrency(totalSettled);
    }

    function renderDebtLedger() {
        const listEl = selectors.debtList;
        if (!listEl) return;

        listEl.innerHTML = '';
        const entries = buildDebtLedgerEntries();
        updateDebtSummary(entries);

        const query = (state.ui.debtQuery || '').trim().toLowerCase();
        if (selectors.debtSearch) selectors.debtSearch.value = state.ui.debtQuery || '';

        let filtered = entries;
        if (query) {
            filtered = filtered.filter(entry => {
                const nameMatch = entry.customer.name.toLowerCase().includes(query);
                const phoneMatch = (entry.customer.phone || '').toLowerCase().includes(query);
                const noteMatch = (entry.debt.description || '').toLowerCase().includes(query);
                return nameMatch || phoneMatch || noteMatch;
            });
        }

        const allowedFilters = new Set(['all', 'open', 'dueSoon', 'overdue', 'settled']);
        const filter = allowedFilters.has(state.ui.debtFilter) ? state.ui.debtFilter : 'all';
        document.querySelectorAll('.debt-filters .filter-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.filter === filter);
        });

        if (filter === 'open') {
            filtered = filtered.filter(entry => entry.status !== 'settled');
        } else if (filter === 'dueSoon') {
            filtered = filtered.filter(entry => entry.status === 'dueSoon');
        } else if (filter === 'overdue') {
            filtered = filtered.filter(entry => entry.status === 'overdue');
        } else if (filter === 'settled') {
            filtered = filtered.filter(entry => entry.status === 'settled');
        }

        const statusOrder = { overdue: 0, dueSoon: 1, onTrack: 2, settled: 3 };
        filtered.sort((a, b) => {
            const rank = statusOrder[a.status] - statusOrder[b.status];
            if (rank !== 0) return rank;
            const dateA = new Date(a.debt.dueDate || a.debt.date || 0);
            const dateB = new Date(b.debt.dueDate || b.debt.date || 0);
            return dateA - dateB;
        });

        if (!filtered.length) {
            selectors.debtEmpty?.removeAttribute('hidden');
            return;
        }

        selectors.debtEmpty?.setAttribute('hidden', 'hidden');

        filtered.forEach(entry => {
            const card = document.createElement('article');
            card.className = 'customer-card debt-card';
            card.dataset.debtId = entry.id;
            card.dataset.customerId = entry.customer.id;

            const customerName = entry.customer.name || translate('customers.title');
            const phoneText = entry.customer.phone || '\u2014';
            const trimmedName = customerName.trim();
            const avatarLetter = trimmedName ? trimmedName.charAt(0).toUpperCase() : '?';
            const avatarColor = getColorForLetter(avatarLetter);

            const statusText = translateStatus(entry.status);
            const statusClass = `debt-status debt-status--${entry.status}`;
            const dueDateText = entry.debt.dueDate ? formatDisplayDate(entry.debt.dueDate) : '\u2014';

            const outstandingLabel = translate('debts.card.outstanding') || 'Outstanding';
            const originalLabel = translate('debts.card.original') || 'Original';
            const paidLabel = translate('debts.card.paid') || 'Paid';
            const dueLabel = translate('debts.card.dueDate') || 'Due';
            const paysOnLabel = translate('debts.card.paysOn') || 'Pays on';

            card.innerHTML = `
                <header class="debt-card-header">
                    <div class="debt-customer">
                        <div class="debt-avatar" style="background: ${avatarColor};">${avatarLetter}</div>
                        <div>
                            <h3 class="debt-customer-name">${escapeHtml(customerName)}</h3>
                            <p class="debt-customer-phone">${escapeHtml(phoneText)}</p>
                        </div>
                    </div>
                    <span class="${statusClass}">${statusText}</span>
                </header>
                <div class="debt-card-body">
                    <div class="debt-pay-date-row">
                        <span>${paysOnLabel}</span>
                        <strong>${dueDateText}</strong>
                    </div>
                    <div class="debt-amount">
                        <span>${outstandingLabel}</span>
                        <strong>${formatCurrency(entry.outstanding)}</strong>
                    </div>
                    <div class="debt-meta">
                        <div class="debt-meta-item">
                            <span>${originalLabel}</span>
                            <strong>${formatCurrency(entry.debt.amount || 0)}</strong>
                        </div>
                        <div class="debt-meta-item">
                            <span>${paidLabel}</span>
                            <strong>${formatCurrency(entry.debt.paidAmount || 0)}</strong>
                        </div>
                        <div class="debt-meta-item">
                            <span>${dueLabel}</span>
                            <strong>${dueDateText}</strong>
                        </div>
                    </div>
                    ${entry.debt.description ? `<p class="debt-note">${escapeHtml(entry.debt.description)}</p>` : ''}
                </div>
                <footer class="debt-card-footer">
                    <button class="secondary-btn" data-action="payment">${translate('debts.card.recordPayment') || 'Record Payment'}</button>
                    <button class="secondary-btn" data-action="demand">${translate('debts.card.demandPayment') || 'Request Payment'}</button>
                    <button class="primary-btn" data-action="debt">${translate('debts.card.addDebt') || 'Add Debt'}</button>
                </footer>
            `;

            card.querySelector('[data-action="payment"]')?.addEventListener('click', () => {
                playFeedbackStrong();
                preparePaymentModal(entry.customer);
            });
            card.querySelector('[data-action="demand"]')?.addEventListener('click', () => {
                playFeedbackStrong();
                prepareDemandModal(entry.customer);
            });
            card.querySelector('[data-action="debt"]')?.addEventListener('click', () => {
                playFeedbackStrong();
                prepareDebtModal(entry.customer);
            });

            listEl.appendChild(card);
        });
    }

    function renderAIDebtCalendar() {
        const listEl = selectors.aiDebtCalendarList;
        if (!listEl) return;

        listEl.innerHTML = '';
        const entries = buildDebtLedgerEntries()
            .filter(entry => entry.status !== 'settled' && entry.debt.dueDate);

        entries.sort((a, b) => new Date(a.debt.dueDate) - new Date(b.debt.dueDate));
        const upcoming = entries.slice(0, 8);

        if (!upcoming.length) {
            const empty = document.createElement('p');
            empty.className = 'ai-calendar-empty';
            empty.textContent = translate('aiDebtCalendar.empty') || 'No upcoming debt payments yet.';
            listEl.appendChild(empty);
            return;
        }

        upcoming.forEach(entry => {
            const item = document.createElement('div');
            item.className = 'ai-calendar-item';

            const dueDate = entry.debt.dueDate;
            const daysLeft = daysUntil(dueDate);
            const status = entry.status;
            const badgeLabel = translateStatus(status);
            const dueLabel = formatDisplayDate(dueDate);
            const dayLabel = formatDaysLeftText(daysLeft);

            item.innerHTML = `
                <div class="ai-calendar-left">
                    <div class="ai-calendar-date">${dueLabel}</div>
                    <div class="ai-calendar-customer">${escapeHtml(entry.customer.name)} · ${dayLabel}</div>
                </div>
                <div class="ai-calendar-right">
                    <div class="ai-calendar-amount">${formatCurrency(entry.outstanding)}</div>
                    <div class="ai-calendar-badge ${status}">${badgeLabel}</div>
                </div>
            `;

            listEl.appendChild(item);
        });
    }

    function renderNotes() {
        renderNotesV3();
    }

    function renderNotesV3() {
        const gridEl = document.getElementById('notes-grid-modern');
        const foldersEl = document.getElementById('folders-grid-view');
        const gridViewEl = document.getElementById('notes-grid-view');
        const activeTab = state.ui.notesTab || 'all';

        // Update Tab UI
        document.querySelectorAll('.notes-tab-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.tab === activeTab);
        });

        if (activeTab === 'folders') {
            gridViewEl.style.display = 'none';
            foldersEl.style.display = 'block';
            return;
        } else {
            gridViewEl.style.display = 'block';
            foldersEl.style.display = 'none';
        }

        if (!gridEl) return;
        gridEl.innerHTML = '';

        const query = (state.ui.notesQuery || '').toLowerCase();
        const filtered = state.notes
            .filter(note => !query || note.title.toLowerCase().includes(query) || (note.body || '').toLowerCase().includes(query))
            .sort((a, b) => (b.pinned - a.pinned) || ((b.updatedAt || b.createdAt) - (a.updatedAt || a.createdAt)));

        filtered.forEach(note => {
            const card = document.createElement('div');
            card.className = 'note-card-modern';
            card.dataset.noteId = note.id;

            const date = new Date(note.updatedAt || note.createdAt);
            const dateStr = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

            card.innerHTML = `
                <span class="note-date">${dateStr}</span>
                <h3 class="note-title-modern">${escapeHtml(note.title || 'Untitled')}</h3>
                <div class="note-snippet">${escapeHtml(note.body || '').substring(0, 100)}...</div>
                <div class="note-tags-modern">
                    <span class="note-tag-pill">Personal</span>
                </div>
            `;

            card.addEventListener('click', () => {
                forms.note.reset();
                setModalMode(forms.note, 'edit');
                forms.note.elements.title.value = note.title;
                forms.note.elements.body.value = note.body;
                forms.note.elements.noteId.value = note.id;
                modals.note.showModal();
            });

            gridEl.appendChild(card);
        });
    }

    function renderNotes_OLD() {
        const { notesList, notesSearch, notesFilter } = selectors;
        if (!notesList) return;

        const query = (state.ui.notesQuery || '').toLowerCase();
        const filter = state.ui.notesFilter || 'all';
        const colorFilter = String(state.ui.notesColorFilter || 'all');

        if (notesSearch) notesSearch.value = state.ui.notesQuery || '';
        if (notesFilter) notesFilter.value = filter;

        document.querySelectorAll('#notes-section .filter-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.filter === filter);
        });
        document.querySelectorAll('#notes-section .color-filter-btn').forEach(btn => {
            btn.classList.toggle('active', Array.isArray(state.ui.notesColorFilter) && state.ui.notesColorFilter.includes(btn.dataset.color));
        });
        document.querySelectorAll('.color-filter-pill').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.color === colorFilter);
        });

        renderNotesNewFormat();
    }

    // Render notes in new modern format V2
    function renderNotesNewFormat() {
        const notesList = document.getElementById('notes-list');
        const notesEmpty = document.getElementById('notes-empty');
        const notesCountEl = document.getElementById('notes-total-count');
        const pinnedCountEl = document.getElementById('notes-pinned-count');
        const recentCountEl = document.getElementById('notes-recent-count');

        if (!notesList) return;

        // Clear existing content
        notesList.innerHTML = '';

        const query = (state.ui.notesQuery || '').toLowerCase();
        const colorFilter = String(state.ui.notesColorFilter || 'all');
        const filter = state.ui.notesFilter || 'all';

        const filtered = [...state.notes]
            .filter(note => {
                if (query && !(
                    note.title.toLowerCase().includes(query) ||
                    (note.body || '').toLowerCase().includes(query)
                )) return false;
                if (colorFilter !== 'all' && (note.color || 'yellow') !== colorFilter) return false;
                if (filter === 'pinned') return !!note.pinned;
                if (filter === 'recent') {
                    const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
                    return (note.updatedAt || note.createdAt || 0) > sevenDaysAgo;
                }
                if (filter !== 'all' && filter !== 'pinned' && filter !== 'recent') {
                    return (note.color || 'yellow') === filter;
                }
                return true;
            })
            .sort((a, b) => (b.pinned - a.pinned) || ((b.updatedAt || b.createdAt) - (a.updatedAt || a.createdAt)));

        // Update notes count
        if (notesCountEl) {
            notesCountEl.textContent = state.notes.length;
        }
        if (pinnedCountEl || recentCountEl) {
            const recentSince = Date.now() - 7 * 24 * 60 * 60 * 1000;
            let pinnedCount = 0;
            let recentCount = 0;
            state.notes.forEach(note => {
                if (note.pinned) pinnedCount += 1;
                if ((note.updatedAt || note.createdAt || 0) >= recentSince) recentCount += 1;
            });
            if (pinnedCountEl) pinnedCountEl.textContent = pinnedCount;
            if (recentCountEl) recentCountEl.textContent = recentCount;
        }

        if (!filtered.length) {
            if (notesEmpty) notesEmpty.removeAttribute('hidden');
            return;
        }

        if (notesEmpty) notesEmpty.setAttribute('hidden', 'hidden');

        filtered.forEach((note, index) => {
            const card = document.createElement('div');
            card.className = `note-card-v2 color-${note.color || 'yellow'}`;
            card.dataset.noteId = note.id;
            card.style.animationDelay = `${index * 50}ms`;

            // Pin badge
            if (note.pinned) {
                const pinBadge = document.createElement('div');
                pinBadge.className = 'note-pin-badge';
                pinBadge.textContent = '📌';
                card.appendChild(pinBadge);
            }

            // Title
            const title = document.createElement('h3');
            title.className = 'note-title-v2';
            title.textContent = note.title || (state.language === 'bn' ? 'শিরোনামহীন নোট' : 'Untitled Note');

            // Preview
            const preview = document.createElement('p');
            preview.className = 'note-preview-v2';
            preview.textContent = note.body || '';

            // Footer
            const footer = document.createElement('div');
            footer.className = 'note-footer-v2';

            const dateSpan = document.createElement('span');
            dateSpan.className = 'note-date-v2';
            const noteDate = new Date(note.updatedAt || note.createdAt);
            const today = new Date();
            const isToday = noteDate.toDateString() === today.toDateString();
            const yesterday = new Date(today);
            yesterday.setDate(yesterday.getDate() - 1);
            const isYesterday = noteDate.toDateString() === yesterday.toDateString();

            if (isToday) {
                dateSpan.textContent = state.language === 'bn' ? 'আজ' : 'Today';
            } else if (isYesterday) {
                dateSpan.textContent = state.language === 'bn' ? 'গতকাল' : 'Yesterday';
            } else {
                dateSpan.textContent = noteDate.toLocaleDateString(state.language === 'bn' ? 'bn-BD' : 'en-US', {
                    month: 'short',
                    day: 'numeric'
                });
            }

            const actions = document.createElement('div');
            actions.className = 'note-actions-v2';

            // Pin button
            const pinBtn = document.createElement('button');
            pinBtn.className = 'note-action-btn-v2';
            pinBtn.innerHTML = note.pinned
                ? '<svg viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" stroke-width="2"><path d="M12 17a2 2 0 0 0 2-2V9h3l-5-5-5 5h3v6a2 2 0 0 0 2 2z"/><line x1="12" y1="17" x2="12" y2="22"/></svg>'
                : '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 17a2 2 0 0 0 2-2V9h3l-5-5-5 5h3v6a2 2 0 0 0 2 2z"/><line x1="12" y1="17" x2="12" y2="22"/></svg>';
            pinBtn.title = note.pinned ? (state.language === 'bn' ? 'আনপিন' : 'Unpin') : (state.language === 'bn' ? 'পিন করুন' : 'Pin');
            pinBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                const existingNote = state.notes.find(n => n.id === note.id);
                if (existingNote) {
                    existingNote.pinned = !existingNote.pinned;
                    existingNote.updatedAt = Date.now();
                    saveState();
                    renderNotes();
                    playFeedback();
                }
            });

            // Delete button
            const deleteBtn = document.createElement('button');
            deleteBtn.className = 'note-action-btn-v2 delete';
            deleteBtn.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2"/></svg>';
            deleteBtn.title = state.language === 'bn' ? 'মুছে ফেলুন' : 'Delete';
            deleteBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                if (confirm(state.language === 'bn' ? 'এই নোটটি মুছে ফেলতে চান?' : 'Delete this note?')) {
                    state.notes = state.notes.filter(n => n.id !== note.id);
                    saveState();
                    renderNotes();
                    playFeedback();
                }
            });

            actions.appendChild(pinBtn);
            actions.appendChild(deleteBtn);

            footer.appendChild(dateSpan);
            footer.appendChild(actions);

            card.appendChild(title);
            card.appendChild(preview);
            card.appendChild(footer);

            // Click to edit
            card.addEventListener('click', () => {
                forms.note.reset();
                setModalMode(forms.note, 'edit');
                forms.note.elements.title.value = note.title;
                forms.note.elements.body.value = note.body;
                forms.note.elements.color.value = note.color || 'yellow';
                forms.note.elements.pinned.checked = !!note.pinned;
                forms.note.elements.noteId.value = note.id;
                modals.note.showModal();
            });

            notesList.appendChild(card);
        });
    }

    function renderTasks() {
        renderHabitTracker();
    }

    function renderHabitTracker() {
        const calendarStrip = document.getElementById('task-calendar-strip');
        const habitsList = document.getElementById('habit-tasks-list');
        if (!calendarStrip || !habitsList) return;

        // Render Calendar Strip
        calendarStrip.innerHTML = '';
        const today = new Date();
        const selectedDate = state.ui.selectedDate || todayString();

        for (let i = -3; i <= 3; i++) {
            const date = new Date(today);
            date.setDate(today.getDate() + i);
            const dateISO = date.toISOString().split('T')[0];
            const isActive = dateISO === selectedDate;

            const dayName = date.toLocaleDateString('en-US', { weekday: 'short' });
            const dayNum = date.getDate();

            const dayCard = document.createElement('div');
            dayCard.className = `calendar-day-card ${isActive ? 'active' : ''}`;
            dayCard.innerHTML = `
                <span class="calendar-day-name">${dayName}</span>
                <span class="calendar-day-number">${dayNum}</span>
                <div class="calendar-day-status">
                    <span class="status-dot"></span>
                </div>
            `;
            dayCard.addEventListener('click', () => {
                state.ui.selectedDate = dateISO;
                saveState();
                renderHabitTracker();
            });
            calendarStrip.appendChild(dayCard);
        }

        // Render Habits
        habitsList.innerHTML = '';
        const tasksForDate = state.tasks.filter(t => t.dueDate === selectedDate || (!t.dueDate && selectedDate === todayString()));

        if (tasksForDate.length === 0) {
            habitsList.innerHTML = '<p class="empty-state">No tasks for this day.</p>';
            return;
        }

        tasksForDate.forEach(task => {
            const habitCard = document.createElement('div');
            habitCard.className = `habit-card ${task.done ? 'checked' : ''}`;

            habitCard.innerHTML = `
                <div class="habit-checkbox ${task.done ? 'checked' : ''}">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><polyline points="20 6 9 17 4 12"></polyline></svg>
                </div>
                <div class="habit-content">
                    <h3 class="habit-title">${escapeHtml(task.name)}</h3>
                    <div class="habit-streak">🔥 <span>7 in a row. Good job!</span></div>
                </div>
            `;

            habitCard.querySelector('.habit-checkbox').addEventListener('click', (e) => {
                e.stopPropagation();
                task.done = !task.done;
                saveState();
                renderHabitTracker();
                playFeedback();
            });

            habitCard.addEventListener('click', () => {
                forms.task.reset();
                setModalMode(forms.task, 'edit');
                forms.task.elements.name.value = task.name;
                forms.task.elements.taskId.value = task.id;
                modals.task.showModal();
            });

            habitsList.appendChild(habitCard);
        });
    }

    function renderTasks_OLD() {
        renderTodoCategories();
        renderNewTodoList(getCurrentTodoCategory());
        renderSimpleTodoList();
        updateTodoStats();
    }

    function renderTodoCategories() {
        const categoriesGrid = document.getElementById('todo-categories-grid');
        const categoriesEmpty = document.getElementById('categories-empty');
        const detailView = document.getElementById('todo-detail-view');
        const categoriesView = document.getElementById('todo-categories-view');

        if (!categoriesGrid) return;

        // Group tasks by category (using type as category for now)
        const categories = {};
        state.tasks.forEach(task => {
            // Map old task types to new categories
            let category = task.type || 'other';
            if (['payment', 'delivery', 'purchase', 'meeting', 'reminder'].includes(category)) {
                category = 'work'; // Map old types to work category
            }
            if (!categories[category]) {
                categories[category] = {
                    name: category,
                    tasks: [],
                    completed: 0
                };
            }
            categories[category].tasks.push(task);
            if (task.done) categories[category].completed++;
        });

        // Add default categories if empty
        const defaultCategories = ['work', 'personal', 'shopping', 'other'];
        defaultCategories.forEach(cat => {
            if (!categories[cat]) {
                categories[cat] = {
                    name: cat,
                    tasks: [],
                    completed: 0
                };
            }
        });

        categoriesGrid.innerHTML = '';

        // Show empty state only if there are no tasks at all
        if (state.tasks.length === 0) {
            if (categoriesEmpty) categoriesEmpty.removeAttribute('hidden');
            return;
        }

        if (categoriesEmpty) categoriesEmpty.setAttribute('hidden', 'hidden');

        const categoryColors = {
            work: 'linear-gradient(135deg, #fef3c7 0%, #fde68a 100%)',
            personal: 'linear-gradient(135deg, #ddd6fe 0%, #c4b5fd 100%)',
            shopping: 'linear-gradient(135deg, #d1fae5 0%, #a7f3d0 100%)',
            other: 'linear-gradient(135deg, #fce7f3 0%, #fbcfe8 100%)'
        };

        Object.values(categories).forEach(category => {
            const card = document.createElement('div');
            card.className = 'todo-category-card';
            card.style.background = categoryColors[category.name] || categoryColors.other;
            card.dataset.category = category.name;

            const nameEl = document.createElement('h3');
            nameEl.className = 'todo-category-name';
            nameEl.textContent = category.name.charAt(0).toUpperCase() + category.name.slice(1);

            const countEl = document.createElement('p');
            countEl.className = 'todo-category-count';
            countEl.textContent = `${category.completed} of ${category.tasks.length} Tasks`;

            const previewEl = document.createElement('div');
            previewEl.className = 'todo-category-tasks-preview';
            const previewTasks = category.tasks.slice(0, 3);
            previewTasks.forEach(task => {
                const taskItem = document.createElement('div');
                taskItem.style.textDecoration = task.done ? 'line-through' : 'none';
                taskItem.style.opacity = task.done ? '0.6' : '1';
                taskItem.textContent = (task.done ? '✓ ' : '○ ') + task.name;
                previewEl.appendChild(taskItem);
            });

            card.appendChild(nameEl);
            card.appendChild(countEl);
            if (previewTasks.length > 0) {
                card.appendChild(previewEl);
            }

            card.addEventListener('click', () => {
                if (categoriesView) categoriesView.hidden = true;
                if (detailView) {
                    detailView.hidden = false;
                    renderTodoDetail(category.name);
                }
            });

            categoriesGrid.appendChild(card);
        });
    }

    function renderTodoDetail(categoryName) {
        const tasksList = document.getElementById('todo-tasks-list');
        const tasksEmpty = document.getElementById('todo-tasks-empty');
        const categoryTitle = document.getElementById('todo-category-title');
        const categoryCount = document.getElementById('todo-category-count');

        if (!tasksList) return;

        // Filter tasks by category, mapping old types to new categories
        const categoryTasks = state.tasks.filter(t => {
            let taskCategory = t.type || 'other';
            // Map old task types to new categories
            if (['payment', 'delivery', 'purchase', 'meeting', 'reminder'].includes(taskCategory)) {
                taskCategory = 'work';
            }
            return taskCategory === categoryName;
        });
        const completed = categoryTasks.filter(t => t.done).length;

        if (categoryTitle) {
            categoryTitle.textContent = categoryName.charAt(0).toUpperCase() + categoryName.slice(1);
        }
        if (categoryCount) {
            categoryCount.textContent = `${completed} of ${categoryTasks.length} Tasks`;
        }

        tasksList.innerHTML = '';

        if (categoryTasks.length === 0) {
            if (tasksEmpty) tasksEmpty.removeAttribute('hidden');
            return;
        }

        if (tasksEmpty) tasksEmpty.setAttribute('hidden', 'hidden');

        categoryTasks.forEach(task => {
            const item = document.createElement('div');
            item.className = 'todo-task-item';
            if (task.done) item.classList.add('completed');

            const checkbox = document.createElement('div');
            checkbox.className = 'todo-task-checkbox';
            if (task.done) checkbox.classList.add('checked');
            checkbox.innerHTML = task.done ? '✓' : '';
            checkbox.addEventListener('click', () => {
                task.done = !task.done;
                saveState();
                renderTasks();
                renderTodoDetail(categoryName);
                playFeedback();
            });

            const text = document.createElement('div');
            text.className = 'todo-task-text';
            text.textContent = task.name;

            item.appendChild(checkbox);
            item.appendChild(text);
            tasksList.appendChild(item);
        });
    }

    function updateTaskStats() {
        const totalTasks = state.tasks.length;
        const completedTasks = state.tasks.filter(t => t.done).length;
        const pendingTasks = totalTasks - completedTasks;

        const totalEl = document.getElementById('tasks-total');
        const completedEl = document.getElementById('tasks-completed');
        const pendingEl = document.getElementById('tasks-pending');

        if (totalEl) totalEl.textContent = `${totalTasks} Total`;
        if (completedEl) completedEl.textContent = `${completedTasks} Done`;
        if (pendingEl) pendingEl.textContent = `${pendingTasks} Pending`;
    }

    function renderTaskCards() {
        const { tasksList, tasksEmpty } = selectors;
        if (!tasksList) return;
        tasksList.innerHTML = '';

        const selectedDate = state.ui.selectedDate || todayString();
        const itemsForDate = getCalendarItemsForDate(selectedDate);

        if (!itemsForDate.length) {
            if (tasksEmpty) {
                const msg = tasksEmpty.querySelector('p');
                if (msg) msg.textContent = translate('calendar.empty');
                tasksEmpty.removeAttribute('hidden');
            }
            return;
        }
        if (tasksEmpty) {
            const msg = tasksEmpty.querySelector('p');
            if (msg) msg.textContent = translate('tasks.empty');
            tasksEmpty.setAttribute('hidden', 'hidden');
        }

        itemsForDate.forEach(item => {
            if (item.kind === 'debt') {
                const fragment = document.importNode(templates.taskCard.content, true);
                localizeFragment(fragment);
                const card = fragment.querySelector('.task-card');
                card.classList.add('debt-reminder');
                card.dataset.taskId = item.id;
                card.querySelector('.task-name').textContent = item.title;
                card.querySelector('.task-type').textContent = `${translate('tasks.card.debtType')} · ${item.customerName}`;
                card.querySelector('.task-date').textContent = formatDisplayDate(item.dueDate);
                card.querySelector('.task-note').textContent = `${translate('tasks.card.debtNote')}: ${formatCurrency(item.amountRemaining)}`;
                card.querySelector('.task-status').style.visibility = 'hidden';
                card.setAttribute('draggable', 'true');
                card.addEventListener('dragstart', e => {
                    draggedTaskId = item.id;
                    e.dataTransfer?.setData('text/plain', item.id);
                });
                tasksList.appendChild(fragment);
            } else {
                const fragment = document.importNode(templates.taskCard.content, true);
                localizeFragment(fragment);
                const card = fragment.querySelector('.task-card');
                card.dataset.taskId = item.id;
                card.dataset.priority = item.priority || 'medium';

                // Add priority class for styling
                if (item.priority) {
                    card.classList.add(`priority-${item.priority}`);
                }

                card.querySelector('.task-name').textContent = item.name;

                // Priority badge
                const priorityEl = card.querySelector('.task-priority');
                if (priorityEl && item.priority) {
                    const priorityLabels = {
                        low: '🟢 Low',
                        medium: '🟡 Medium',
                        high: '🔴 High',
                        urgent: '⚡ Urgent'
                    };
                    priorityEl.textContent = priorityLabels[item.priority] || '';
                    priorityEl.className = `task-priority priority-${item.priority}`;
                }

                card.querySelector('.task-type').textContent = translateTaskType(item.type);

                // Format date with time if available
                let dateText = formatDisplayDate(item.dueDate);
                if (item.dueTime) {
                    dateText += ` at ${item.dueTime}`;
                }
                card.querySelector('.task-date').textContent = dateText;

                card.querySelector('.task-note').textContent = item.note;
                card.querySelector('.task-note').hidden = !item.note;

                // Recurring indicator
                if (item.recurring) {
                    const recurringBadge = document.createElement('span');
                    recurringBadge.className = 'task-recurring-badge';
                    recurringBadge.textContent = '🔄';
                    recurringBadge.title = `Repeats ${item.recurringType || 'daily'}`;
                    card.querySelector('.task-header-top')?.appendChild(recurringBadge);
                }

                const checkbox = card.querySelector('input[type="checkbox"]');
                checkbox.checked = item.done;
                const doneLabel = card.querySelector('.task-status span');
                doneLabel.textContent = item.done ? translate('tasks.card.completed') : translate('tasks.card.done');
                checkbox.addEventListener('change', () => {
                    item.done = checkbox.checked;
                    if (!item.done) {
                        item.reminderSent = false;
                    }
                    saveState();
                    renderTasks();
                    playFeedback();
                });

                // Edit button
                const editBtn = card.querySelector('[data-action="edit"]');
                if (editBtn) {
                    editBtn.addEventListener('click', () => {
                        forms.task.reset();
                        setModalMode(forms.task, 'edit');
                        forms.task.elements.name.value = item.name;
                        forms.task.elements.type.value = item.type || 'other';
                        forms.task.elements.priority.value = item.priority || 'medium';
                        forms.task.elements.dueDate.value = item.dueDate;
                        forms.task.elements.dueTime.value = item.dueTime || '';
                        forms.task.elements.note.value = item.note || '';
                        forms.task.elements.recurring.checked = !!item.recurring;
                        forms.task.elements.recurringType.value = item.recurringType || 'daily';
                        forms.task.elements.taskId.value = item.id;
                        modals.task.showModal();
                    });
                }

                card.querySelector('[data-action="delete"]').addEventListener('click', () => {
                    if (confirm(translate('tasks.deleteConfirm') || 'Are you sure you want to delete this task?')) {
                        state.tasks = state.tasks.filter(task => task.id !== item.id);
                        saveState();
                        renderTasks();
                        playFeedback();
                    }
                });

                card.setAttribute('draggable', 'true');
                card.addEventListener('dragstart', e => {
                    draggedTaskId = item.id;
                    e.dataTransfer?.setData('text/plain', item.id);
                });

                tasksList.appendChild(fragment);
            }
        });
    }

    function renderCalendarToContainer(container) {
        if (!container) return;
        container.innerHTML = '';

        const selectedDate = state.ui.selectedDate || todayString();
        // Parse date string directly to avoid timezone issues
        const [yearStr, monthStr, dayStr] = selectedDate.split('-');
        const year = parseInt(yearStr, 10);
        const month = parseInt(monthStr, 10) - 1; // Month is 0-indexed
        const monthNames = translate('calendar.monthNames');
        const dayNames = translate('calendar.dayNames');

        const header = document.createElement('div');
        header.className = 'calendar-header';
        header.style.gridColumn = '1 / -1';
        header.style.display = 'flex';
        header.style.justifyContent = 'space-between';
        header.style.alignItems = 'center';
        header.style.marginBottom = '8px';

        const title = document.createElement('strong');
        title.textContent = `${monthNames[month]} ${year}`;
        header.appendChild(title);

        const navWrapper = document.createElement('div');
        navWrapper.style.display = 'flex';
        navWrapper.style.gap = '8px';

        const prevBtn = document.createElement('button');
        prevBtn.type = 'button';
        prevBtn.textContent = '‹';
        prevBtn.className = 'secondary-btn';
        prevBtn.style.padding = '6px 12px';
        prevBtn.addEventListener('click', () => shiftCalendarMonth(-1));

        const nextBtn = document.createElement('button');
        nextBtn.type = 'button';
        nextBtn.textContent = '›';
        nextBtn.className = 'secondary-btn';
        nextBtn.style.padding = '6px 12px';
        nextBtn.addEventListener('click', () => shiftCalendarMonth(1));

        navWrapper.appendChild(prevBtn);
        navWrapper.appendChild(nextBtn);
        header.appendChild(navWrapper);

        container.appendChild(header);

        dayNames.forEach(day => {
            const cell = document.createElement('div');
            cell.textContent = day;
            cell.style.textAlign = 'center';
            cell.style.fontWeight = '600';
            cell.style.color = 'var(--text-soft)';
            container.appendChild(cell);
        });

        const firstDay = new Date(year, month, 1);
        const startDay = firstDay.getDay();
        const daysInMonth = new Date(year, month + 1, 0).getDate();

        for (let i = 0; i < startDay; i++) {
            const filler = document.createElement('div');
            container.appendChild(filler);
        }

        const itemsByDate = buildCalendarItemsMap(year, month);
        const todayISO = todayString();
        for (let day = 1; day <= daysInMonth; day++) {
            const dateISO = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
            const button = document.createElement('button');
            button.type = 'button';
            button.textContent = day;
            button.dataset.date = dateISO;

            if (dateISO === todayISO) {
                button.classList.add('today');
            }
            if (itemsByDate.has(dateISO)) {
                button.classList.add('has-items');
            }
            if (dateISO === selectedDate) {
                button.classList.add('selected');
            }

            button.addEventListener('click', () => {
                state.ui.selectedDate = dateISO;
                saveState();
                renderTasks();
            });

            button.addEventListener('dragover', e => {
                if (draggedTaskId) e.preventDefault();
            });
            button.addEventListener('drop', e => {
                e.preventDefault();
                const taskId = draggedTaskId || e.dataTransfer?.getData('text/plain');
                if (!taskId) return;
                const task = state.tasks.find(t => t.id === taskId);
                if (task) {
                    task.dueDate = dateISO;
                    saveState();
                    renderTasks();
                    playFeedback();
                }
                draggedTaskId = '';
            });

            container.appendChild(button);
        }
    }

    function renderCalendar() {
        renderCalendarToContainer(selectors.miniCalendar);
        renderCalendarToContainer(selectors.tasksMiniCalendar);
    }

    function shiftCalendarMonth(offset) {
        const selectedDate = state.ui.selectedDate || todayString();
        // Parse date string directly to avoid timezone issues
        const [yearStr, monthStr] = selectedDate.split('-');
        let year = parseInt(yearStr, 10);
        let month = parseInt(monthStr, 10) - 1; // Month is 0-indexed

        month += offset;
        // Handle year rollover
        while (month < 0) {
            month += 12;
            year -= 1;
        }
        while (month > 11) {
            month -= 12;
            year += 1;
        }

        // Format back to YYYY-MM-DD
        state.ui.selectedDate = `${year}-${String(month + 1).padStart(2, '0')}-01`;
        saveState();
        renderCalendar();
        renderTasks();
    }

    function buildCalendarItemsMap(year, month) {
        const map = new Map();
        const add = (date, item) => {
            if (!map.has(date)) map.set(date, []);
            map.get(date).push(item);
        };

        state.tasks.forEach(task => {
            if (!task.dueDate) return;
            const taskDate = task.dueDate;
            if (taskDate.startsWith(`${year}-${String(month + 1).padStart(2, '0')}`)) {
                add(taskDate, { kind: 'task', ref: task });
            }
        });

        state.customers.forEach(customer => {
            customer.debts.forEach(debt => {
                if (getDebtOutstanding(debt) <= 0) return;
                if (!debt.dueDate) return;
                if (debt.dueDate.startsWith(`${year}-${String(month + 1).padStart(2, '0')}`)) {
                    add(debt.dueDate, { kind: 'debt', ref: debt, customer });
                }
            });
        });

        return map;
    }

    function getCalendarItemsForDate(dateISO) {
        const items = [];
        state.tasks
            .filter(task => task.dueDate === dateISO)
            .sort((a, b) => a.done - b.done || a.createdAt - b.createdAt)
            .forEach(task => items.push({ ...task, kind: 'task' }));

        state.customers.forEach(customer => {
            customer.debts.forEach(debt => {
                if (getDebtOutstanding(debt) <= 0) return;
                if (debt.dueDate === dateISO) {
                    items.push({
                        kind: 'debt',
                        id: `${customer.id}-${debt.id}`,
                        customerName: customer.name,
                        amountRemaining: getDebtOutstanding(debt),
                        dueDate: debt.dueDate,
                        title: customer.name
                    });
                }
            });
        });

        return items;
    }

    function prepareDebtModal(customer) {
        forms.debt.reset();
        populateDebtCustomerSelect();
        if (forms.debt.elements.customerId) {
            forms.debt.elements.customerId.value = customer.id;
        }
        if (forms.debt.elements.date) {
            forms.debt.elements.date.value = todayString();
        }
        hideDebtVoicePreview();
        modals.debt.showModal();
    }

    function preparePaymentModal(customer) {
        forms.payment.reset();
        forms.payment.elements.customerId.value = customer.id;
        forms.payment.elements.date.value = todayString();
        modals.payment.showModal();
    }

    function prepareDemandModal(customer) {
        forms.demand.reset();
        forms.demand.elements.customerId.value = customer.id;
        const outstanding = Math.max(1, getCustomerBalance(customer));
        forms.demand.elements.amount.value = outstanding;
        const dueInfo = getCustomerDueInfo(customer);
        forms.demand.elements.dueDate.value = dueInfo.nextDueDate || todayString();
        if (selectors.demandPreviewImg) selectors.demandPreviewImg.src = '';
        if (selectors.demandDownloadBtn) selectors.demandDownloadBtn.removeAttribute('href');
        lastDemandCardUrl = '';
        selectors.demandShareBtn?.setAttribute('disabled', 'disabled');
        selectors.demandDownloadBtn?.setAttribute('disabled', 'disabled');
        selectors.demandPreviewText?.removeAttribute('hidden');
        modals.demand.showModal();
    }

    function attachCustomerCardActions(card, customer) {
        // Placeholder if needed later
    }

    function translateStatus(status) {
        switch (status) {
            case 'settled':
                return translate('customers.card.settled');
            case 'dueSoon':
                return translate('customers.card.dueSoon');
            case 'overdue':
                return translate('customers.card.overdue');
            default:
                return translate('customers.card.onTrack');
        }
    }

    function getCustomerBalance(customer) {
        return roundMoney(customer.debts.reduce((sum, debt) => sum + getDebtOutstanding(debt), 0));
    }

    function getCustomerDueInfo(customer) {
        const outstandingDebts = (customer.debts || [])
            .map(debt => normalizeDebtRecord(debt, customer))
            .filter(debt => debt && getDebtOutstanding(debt) > 0);
        if (!outstandingDebts.length) {
            return { status: 'settled', nextDueDate: null };
        }
        const withDueDate = outstandingDebts.filter(debt => debt.dueDate);
        if (!withDueDate.length) {
            return { status: 'onTrack', nextDueDate: null };
        }
        const nextDueDebt = withDueDate.reduce((earliest, current) => {
            if (!earliest) return current;
            return new Date(current.dueDate) < new Date(earliest.dueDate) ? current : earliest;
        }, null);
        if (!nextDueDebt) {
            return { status: 'onTrack', nextDueDate: null };
        }
        const daysLeft = daysUntil(nextDueDebt.dueDate);
        let status = 'onTrack';
        if (daysLeft < 0) status = 'overdue';
        else if (daysLeft <= 2) status = 'dueSoon';
        return { status, nextDueDate: nextDueDebt.dueDate };
    }

    function getDebtOutstanding(debt) {
        return roundMoney(Math.max(0, (debt.amount || 0) - (debt.paidAmount || 0)));
    }

    function getDebtStatus(debt) {
        const outstanding = getDebtOutstanding(debt);
        if (outstanding <= 0) return 'settled';
        if (!debt.dueDate) return 'onTrack';
        const daysLeft = daysUntil(debt.dueDate);
        if (Number.isNaN(daysLeft)) return 'onTrack';
        if (daysLeft < 0) return 'overdue';
        if (daysLeft <= 2) return 'dueSoon';
        return 'onTrack';
    }

    function formatDaysLeftText(daysLeft) {
        if (state.language === 'bn') {
            if (daysLeft === 0) return 'আজ';
            if (daysLeft === 1) return '১ দিন বাকি';
            if (daysLeft > 1) return `${daysLeft} দিন বাকি`;
            return `${Math.abs(daysLeft)} দিন পেরিয়েছে`;
        }
        if (daysLeft === 0) return 'Today';
        if (daysLeft === 1) return '1 day left';
        if (daysLeft > 1) return `${daysLeft} days left`;
        return `${Math.abs(daysLeft)} days overdue`;
    }

    function buildHistoryEntry(entry, customer) {
        const amount = formatCurrency(entry.amount);
        const date = formatDisplayDate(entry.date);
        if (entry.type === 'debt') {
            const desc = entry.description ? ` – ${entry.description}` : '';
            return `${date}: +${amount} ${desc}`;
        }
        if (entry.type === 'payment') {
            const note = entry.description ? ` – ${entry.description}` : '';
            return `${date}: -${amount} ${note}`;
        }
        if (entry.type === 'demand') {
            const note = entry.description ? ` – ${entry.description}` : '';
            return `${date}: ⚡ ${amount}${note}`;
        }
        return `${date}: ${amount}`;
    }

    function applyLanguage(lang, options = {}) {
        const nextLang = lang === 'bn' ? 'bn' : 'en';
        state.language = nextLang;
        document.documentElement.lang = nextLang;
        updateLanguageToggleLabel();

        document.querySelectorAll('[data-i18n]').forEach(el => {
            const key = el.dataset.i18n;
            const translated = translate(key);
            if (translated !== undefined) {
                el.textContent = translated;
            }
        });

        document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
            const key = el.dataset.i18nPlaceholder;
            const translated = translate(key);
            if (translated !== undefined) {
                el.setAttribute('placeholder', translated);
            }
        });

        if (!options.initial) {
            saveState();
            renderAll();
        }
        updateLanguageButtons();
        updatePremiumPanelStatus();
        updateAIUsageUI();
    }

    function translate(key) {
        const langTable = translations[state.language] || translations.en;
        const value = langTable[key];
        return value !== undefined ? value : translations.en[key] || key;
    }

    function updateLanguageToggleLabel() {
        if (!selectors.languageToggle) return;
        selectors.languageToggle.textContent = state.language === 'en' ? 'বাংলা' : 'English';
    }

    function localizeFragment(root) {
        if (!root || typeof root.querySelectorAll !== 'function') return;
        root.querySelectorAll('[data-i18n]').forEach(el => {
            const key = el.dataset.i18n;
            const translated = translate(key);
            if (translated !== undefined) {
                el.textContent = translated;
            }
        });
        root.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
            const key = el.dataset.i18nPlaceholder;
            const translated = translate(key);
            if (translated !== undefined) {
                el.setAttribute('placeholder', translated);
            }
        });
    }

    function translateTaskType(type) {
        switch (type) {
            case 'payment':
                return state.language === 'en' ? 'Payment follow-up' : 'পেমেন্ট ফলো-আপ';
            case 'delivery':
                return state.language === 'en' ? 'Delivery' : 'ডেলিভারি';
            case 'purchase':
                return state.language === 'en' ? 'Stock purchase' : 'মালামাল কেনা';
            default:
                return state.language === 'en' ? 'Other task' : 'অন্যান্য কাজ';
        }
    }

    function updateNotificationToggle() {
        const button = selectors.notificationToggle;
        if (!button) return;
        if (!('Notification' in window)) {
            button.disabled = true;
            button.textContent = 'N/A';
            return;
        }
        button.classList.toggle('reminder-active', state.notificationsEnabled);
        button.title = state.notificationsEnabled ? translate('notifications.enabled') : translate('notifications.disabled');
        button.setAttribute('aria-pressed', state.notificationsEnabled);
        button.textContent = state.notificationsEnabled ? '🔔' : '🔕';
    }

    function handleNotificationToggle() {
        playFeedback();
        if (!('Notification' in window)) return;
        if (Notification.permission === 'granted') {
            state.notificationsEnabled = !state.notificationsEnabled;
            saveState();
            updateNotificationToggle();
            return;
        }
        if (Notification.permission === 'denied') {
            alert(translate('notifications.permissionDenied'));
            return;
        }
        Notification.requestPermission().then(permission => {
            if (permission === 'granted') {
                state.notificationsEnabled = true;
                saveState();
            }
            updateNotificationToggle();
        });
    }

    function startReminderLoop() {
        checkReminders();
        setInterval(checkReminders, 60 * 1000);
    }

    function checkReminders() {
        if (!state.notificationsEnabled) return;
        if (!('Notification' in window) || Notification.permission !== 'granted') return;

        const now = todayString();

        state.customers.forEach(customer => {
            customer.debts.forEach(debt => {
                const outstanding = getDebtOutstanding(debt);
                if (outstanding <= 0 || !debt.dueDate) return;
                const diff = daysUntil(debt.dueDate);
                if (diff === 0 && !debt.reminders.dueToday) {
                    const body = translate('notifications.dueTodayBody').replace('{amount}', formatCurrency(outstanding));
                    showNotification(`${translate('notifications.dueToday')} ${customer.name}`, body);
                    debt.reminders.dueToday = true;
                } else if (diff < 0 && !debt.reminders.overdue) {
                    const body = translate('notifications.overdueBody').replace('{amount}', formatCurrency(outstanding));
                    showNotification(`${translate('notifications.overdue')} ${customer.name}`, body);
                    debt.reminders.overdue = true;
                }
            });
        });

        state.tasks.forEach(task => {
            if (task.done) return;
            if (!task.dueDate) return;
            if (task.dueDate === now && !task.reminderSent) {
                const body = translate('notifications.taskDueBody').replace('{task}', task.name);
                showNotification(translate('notifications.taskDue'), body);
                task.reminderSent = true;
            }
        });
        saveState();
    }

    function showNotification(title, body) {
        try {
            new Notification(title, { body });
        } catch (error) {
            console.warn('Notification error', error);
        }
    }

    async function generateDemandCard(customer, options) {
        const canvas = document.createElement('canvas');
        canvas.width = 900;
        canvas.height = 500;
        const ctx = canvas.getContext('2d');

        const gradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
        gradient.addColorStop(0, 'rgba(28, 139, 115, 0.9)');
        gradient.addColorStop(1, 'rgba(16, 101, 82, 0.9)');
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        ctx.fillStyle = '#fff';
        ctx.fillRect(40, 40, canvas.width - 80, canvas.height - 80);

        // Shop info
        ctx.fillStyle = '#1d2b2f';
        ctx.font = 'bold 28px Inter, sans-serif';
        ctx.fillText(state.shop?.shopName || 'Shop Name', 70, 90);
        ctx.font = '20px Inter, sans-serif';
        ctx.fillText(state.shop?.ownerName || '', 70, 120);

        ctx.font = 'bold 24px Inter, sans-serif';
        ctx.fillText('Payment Demand', 70, 170);

        ctx.font = '24px Inter, sans-serif';
        ctx.fillText(customer.name, 70, 210);
        ctx.fillStyle = '#4c6268';
        ctx.font = '18px Inter, sans-serif';
        ctx.fillText(options.paymentMethod || 'Payment method: —', 70, 245);

        ctx.fillStyle = '#1c8b73';
        ctx.font = 'bold 64px Inter, sans-serif';
        ctx.fillText(formatCurrency(options.amount), 70, 320);

        ctx.fillStyle = '#1d2b2f';
        ctx.font = '22px Inter, sans-serif';
        ctx.fillText(`Due: ${options.dueDate ? formatDisplayDate(options.dueDate) : '—'}`, 70, 370);

        ctx.fillStyle = '#4c6268';
        ctx.font = '18px Inter, sans-serif';
        ctx.fillText(options.note ? `Note: ${options.note}` : 'Please settle this payment at the earliest.', 70, 405);

        // Payment numbers
        if (state.shop?.paymentMethods) {
            let y = 440;
            ctx.fillStyle = '#1d2b2f';
            ctx.font = '16px Inter, sans-serif';
            if (state.shop.paymentMethods.bkash?.enabled && state.shop.paymentMethods.bkash.number) {
                ctx.fillText(`bKash: ${state.shop.paymentMethods.bkash.number}`, 70, y);
                y += 25;
            }
            if (state.shop.paymentMethods.nagad?.enabled && state.shop.paymentMethods.nagad.number) {
                ctx.fillText(`Nagad: ${state.shop.paymentMethods.nagad.number}`, 70, y);
                y += 25;
            }
            if (state.shop.paymentMethods.rocket?.enabled && state.shop.paymentMethods.rocket.number) {
                ctx.fillText(`Rocket: ${state.shop.paymentMethods.rocket.number}`, 70, y);
            }
        }

        // Shop logo or owner photo
        const logo = state.shop?.shopLogo || state.shop?.ownerPhoto || state.auth.profilePicture;
        if (logo) {
            try {
                const img = await loadImage(logo);
                ctx.save();
                ctx.beginPath();
                ctx.arc(canvas.width - 140, 140, 60, 0, Math.PI * 2);
                ctx.closePath();
                ctx.clip();
                ctx.drawImage(img, canvas.width - 200, 80, 120, 120);
                ctx.restore();
            } catch (error) {
                console.warn('Logo render failed', error);
            }
        }

        ctx.fillStyle = '#106552';
        ctx.font = '18px Inter, sans-serif';
        ctx.fillText('Generated via Debtx', 70, canvas.height - 60);

        return canvas.toDataURL('image/png');
    }

    async function shareDemandCard(dataUrl, text) {
        if (!dataUrl) return;
        try {
            if (navigator.canShare) {
                const file = await dataUrlToFile(dataUrl, 'demand-card.png');
                if (navigator.canShare({ files: [file], text })) {
                    await navigator.share({ files: [file], text });
                    return;
                }
            }
            if (navigator.share) {
                await navigator.share({ text, url: dataUrl });
                return;
            }
        } catch (error) {
            console.warn('Share failed, falling back', error);
        }
        try {
            await navigator.clipboard.writeText(text);
            alert('Payment request copied. Share it anywhere.');
        } catch (error) {
            console.error('Clipboard error', error);
        }
    }

    async function dataUrlToFile(dataUrl, filename) {
        const res = await fetch(dataUrl);
        const blob = await res.blob();
        return new File([blob], filename, { type: blob.type });
    }

    function base64ToUint8Array(base64) {
        const binary = atob(base64);
        const bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
        return bytes;
    }

    async function pngDataUrlToJpegBytes(pngDataUrl, quality = 0.92) {
        const img = await loadImage(pngDataUrl);
        const w = img.naturalWidth || img.width;
        const h = img.naturalHeight || img.height;
        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        // Fill white so transparent pixels don't render as black in PDF viewers.
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, w, h);
        ctx.drawImage(img, 0, 0, w, h);
        const jpegDataUrl = canvas.toDataURL('image/jpeg', quality);
        const base64 = jpegDataUrl.split(',')[1] || '';
        return { bytes: base64ToUint8Array(base64), width: w, height: h };
    }

    function buildSinglePagePdfFromJpeg(jpegBytes, imageWidthPx, imageHeightPx) {
        const enc = new TextEncoder();
        const chunks = [];
        let offset = 0;
        const offsets = [0]; // xref requires object 0

        const push = (data) => {
            const chunk = typeof data === 'string' ? enc.encode(data) : data;
            chunks.push(chunk);
            offset += chunk.length;
        };

        const markObj = () => offsets.push(offset);

        // A4 portrait in points
        const pageW = 595.28;
        const pageH = 841.89;
        const margin = 36;
        const maxW = pageW - margin * 2;
        const maxH = pageH - margin * 2;
        const aspect = imageWidthPx / imageHeightPx;
        let drawW = maxW;
        let drawH = drawW / aspect;
        if (drawH > maxH) {
            drawH = maxH;
            drawW = drawH * aspect;
        }
        const x = (pageW - drawW) / 2;
        const y = (pageH - drawH) / 2;

        const content = `q\n${drawW.toFixed(2)} 0 0 ${drawH.toFixed(2)} ${x.toFixed(2)} ${y.toFixed(2)} cm\n/Im0 Do\nQ\n`;
        const contentBytes = enc.encode(content);

        push('%PDF-1.3\n');

        markObj();
        push('1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n');

        markObj();
        push('2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n');

        markObj();
        push(`3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${pageW} ${pageH}] /Resources << /XObject << /Im0 4 0 R >> /ProcSet [/PDF /ImageC] >> /Contents 5 0 R >>\nendobj\n`);

        markObj();
        push(`4 0 obj\n<< /Type /XObject /Subtype /Image /Width ${imageWidthPx} /Height ${imageHeightPx} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${jpegBytes.length} >>\nstream\n`);
        push(jpegBytes);
        push('\nendstream\nendobj\n');

        markObj();
        push(`5 0 obj\n<< /Length ${contentBytes.length} >>\nstream\n`);
        push(contentBytes);
        push('\nendstream\nendobj\n');

        const xrefStart = offset;
        push('xref\n0 6\n');
        push('0000000000 65535 f \n');
        for (let i = 1; i <= 5; i++) {
            const off = String(offsets[i]).padStart(10, '0');
            push(`${off} 00000 n \n`);
        }
        push(`trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${xrefStart}\n%%EOF`);

        return new Blob(chunks, { type: 'application/pdf' });
    }

    async function downloadBillPdf(bill, customizeSettings = null) {
        const pngUrl = await generateBillCard(bill, customizeSettings);
        const jpeg = await pngDataUrlToJpegBytes(pngUrl, 0.92);
        const pdfBlob = buildSinglePagePdfFromJpeg(jpeg.bytes, jpeg.width, jpeg.height);
        const url = URL.createObjectURL(pdfBlob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `bill-${bill.invoiceNumber || bill.id}.pdf`;
        a.style.display = 'none';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }

    function loadImage(src) {
        return new Promise((resolve, reject) => {
            const img = new Image();
            img.onload = () => resolve(img);
            img.onerror = reject;
            img.src = src;
        });
    }

    function formatCurrency(amount) {
        const formatted = new Intl.NumberFormat('en-IN', {
            style: 'currency',
            currency: 'BDT',
            maximumFractionDigits: 0
        }).format(Math.round(amount || 0));
        return formatted.replace('BDT', '৳').trim();
    }

    function formatDisplayDate(dateStr) {
        if (!dateStr) return '\u2014';
        const date = new Date(dateStr + 'T00:00');
        if (Number.isNaN(date.getTime())) return dateStr;
        const opts = { day: 'numeric', month: 'short', year: 'numeric' };
        return new Intl.DateTimeFormat(state.language === 'bn' ? 'bn-BD' : 'en-GB', opts).format(date);
    }

    function formatDateTime(ms) {
        const date = new Date(ms);
        const opts = { day: 'numeric', month: 'short', hour: 'numeric', minute: 'numeric' };
        return new Intl.DateTimeFormat(state.language === 'bn' ? 'bn-BD' : 'en-GB', opts).format(date);
    }

    function computeDueDate(date, repaymentDays) {
        const base = new Date(date + 'T00:00');
        base.setDate(base.getDate() + (repaymentDays || 7));
        return base.toISOString().slice(0, 10);
    }

    function daysUntil(date) {
        const target = new Date(date + 'T00:00');
        const now = new Date();
        const diff = target.setHours(0, 0, 0, 0) - now.setHours(0, 0, 0, 0);
        return Math.round(diff / (24 * 60 * 60 * 1000));
    }

    function roundMoney(value) {
        return Math.round((value + Number.EPSILON) * 100) / 100;
    }

    function clampNumber(value, min, max) {
        return Math.min(Math.max(value, min), max);
    }

    function generateId(prefix) {
        return `${prefix}-${Math.random().toString(36).slice(2, 8)}-${Date.now().toString(36)}`;
    }

    function debounce(func, wait) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    }

    function applyThemePreset(theme) {
        const settings = {
            minimal: {
                primaryColor: '#1d2b2f',
                accentColor: '#4a5568',
                bgColor: '#ffffff',
                showBorder: false,
                spacing: 12,
                fontSize: -2
            },
            cozy: {
                primaryColor: '#1c8b73',
                accentColor: '#f2a03d',
                bgColor: '#ffffff',
                showBorder: true,
                spacing: 16,
                fontSize: 0
            },
            professional: {
                primaryColor: '#2563eb',
                accentColor: '#1e40af',
                bgColor: '#f8fafc',
                showBorder: true,
                spacing: 20,
                fontSize: 2
            }
        };

        const preset = settings[theme] || settings.cozy;
        const primaryColorEl = document.getElementById('customize-primary-color');
        const accentColorEl = document.getElementById('customize-accent-color');
        const bgColorEl = document.getElementById('customize-bg-color');
        const borderEl = document.getElementById('customize-border');
        const spacingEl = document.getElementById('customize-spacing');
        const fontSizeEl = document.getElementById('customize-font-size');

        if (primaryColorEl) primaryColorEl.value = preset.primaryColor;
        if (accentColorEl) accentColorEl.value = preset.accentColor;
        if (bgColorEl) bgColorEl.value = preset.bgColor;
        if (borderEl) borderEl.checked = preset.showBorder;
        if (spacingEl) {
            spacingEl.value = preset.spacing;
            const spacingValue = document.getElementById('spacing-value');
            if (spacingValue) spacingValue.textContent = preset.spacing + 'px';
        }
        if (fontSizeEl) {
            fontSizeEl.value = preset.fontSize;
            const fontSizeValue = document.getElementById('font-size-value');
            if (fontSizeValue) fontSizeValue.textContent = (preset.fontSize >= 0 ? '+' : '') + preset.fontSize + 'px';
        }
    }

    function attachNewFeatureHandlers() {
        // Shop Profile
        document.getElementById('edit-shop-profile-btn')?.addEventListener('click', () => {
            openShopProfileModal();
        });

        // Setup Login
        document.getElementById('setup-login-btn')?.addEventListener('click', () => {
            showAuthOverlay();
        });

        // Upgrade Plan Button - Navigate to Premium
        document.querySelectorAll('.upgrade-plan-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                setActivePanel('premium');
                playFeedback();
            });
        });

        // Settings Menu Items
        const showSettingsDetailedContent = () => {
            const detailedContent = document.getElementById('settings-detailed-content');
            const menuCards = document.querySelectorAll('.settings-menu-card');
            if (detailedContent) {
                detailedContent.hidden = false;
                // Hide menu cards when showing detailed content
                menuCards.forEach(card => card.style.display = 'none');
                detailedContent.scrollIntoView({ behavior: 'smooth', block: 'start' });
                // Reinitialize language button handlers when settings panel is shown
                setTimeout(() => {
                    initLanguageButtons();
                }, 100);
            }
            playFeedback();
        };

        document.getElementById('settings-language-item')?.addEventListener('click', (e) => {
            e.preventDefault();
            showSettingsDetailedContent();
            // Show language section, hide others
            setTimeout(() => {
                document.querySelectorAll('.settings-card').forEach(card => {
                    card.style.display = card.id === 'settings-subscription-card' ? 'none' : 'block';
                });
            }, 100);
        });

        document.getElementById('settings-subscription-item')?.addEventListener('click', (e) => {
            e.preventDefault();
            showSettingsDetailedContent();
            // Show subscription section, hide others
            setTimeout(() => {
                document.querySelectorAll('.settings-card').forEach(card => {
                    if (card.id === 'settings-subscription-card') {
                        card.style.display = 'block';
                    } else {
                        card.style.display = 'none';
                    }
                });
                // Update premium status when shown
                if (typeof updatePremiumStatus === 'function') {
                    updatePremiumStatus();
                }
                if (typeof renderPremiumPlans === 'function') {
                    renderPremiumPlans();
                }
            }, 100);
        });

        document.getElementById('settings-my-address-item')?.addEventListener('click', (e) => {
            e.preventDefault();
            showSettingsDetailedContent();
            // Show all sections except subscription
            setTimeout(() => {
                document.querySelectorAll('.settings-card').forEach(card => {
                    card.style.display = card.id === 'settings-subscription-card' ? 'none' : 'block';
                });
            }, 100);
        });

        document.getElementById('settings-notifications-item')?.addEventListener('click', (e) => {
            e.preventDefault();
            showSettingsDetailedContent();
            // Show all sections except subscription
            setTimeout(() => {
                document.querySelectorAll('.settings-card').forEach(card => {
                    card.style.display = card.id === 'settings-subscription-card' ? 'none' : 'block';
                });
            }, 100);
        });

        document.getElementById('settings-account-item')?.addEventListener('click', (e) => {
            e.preventDefault();
            const detailedContent = document.getElementById('settings-detailed-content');
            const menuCards = document.querySelectorAll('.settings-menu-card');
            if (detailedContent) {
                detailedContent.hidden = false;
                // Hide menu cards when showing detailed content
                menuCards.forEach(card => card.style.display = 'none');
                detailedContent.scrollIntoView({ behavior: 'smooth', block: 'start' });
                // Show all sections except subscription
                setTimeout(() => {
                    document.querySelectorAll('.settings-card').forEach(card => {
                        card.style.display = card.id === 'settings-subscription-card' ? 'none' : 'block';
                    });
                    initLanguageButtons();
                }, 100);
            }
            playFeedback();
        });

        // Settings Back Button
        document.getElementById('settings-back-btn')?.addEventListener('click', () => {
            const detailedContent = document.getElementById('settings-detailed-content');
            const menuCards = document.querySelectorAll('.settings-menu-card');
            if (detailedContent) {
                detailedContent.hidden = true;
                // Show menu cards again
                menuCards.forEach(card => card.style.display = '');
                // Show all sections again
                document.querySelectorAll('.settings-card').forEach(card => {
                    card.style.display = card.id === 'settings-subscription-card' ? 'none' : 'block';
                });
                // Scroll back to top of settings
                const settingsPanel = document.getElementById('panel-settings');
                if (settingsPanel) {
                    settingsPanel.scrollTo({ top: 0, behavior: 'smooth' });
                }
            }
            playFeedback();
        });

        // Pricing toggle + plan selection (premium & settings)
        document.querySelectorAll('[data-billing-toggle]').forEach(btn => {
            btn.addEventListener('click', () => {
                setBillingMode(btn.dataset.billingToggle || 'annual');
                highlightPlanCards();
                playFeedback();
            });
        });

        document.querySelectorAll('[data-plan-select]').forEach(btn => {
            btn.addEventListener('click', () => {
                const plan = btn.dataset.planSelect;
                const billing = btn.dataset.billingMode || state.ui.pricingBilling || 'annual';
                handlePlanSelect(plan, billing);
                setBillingMode(billing);
                highlightPlanCards();
                playFeedback();
            });
        });

        // Todo List Navigation
        document.getElementById('back-to-categories-btn')?.addEventListener('click', () => {
            const categoriesView = document.getElementById('todo-categories-view');
            const detailView = document.getElementById('todo-detail-view');
            if (categoriesView && detailView) {
                categoriesView.hidden = false;
                detailView.hidden = true;
            }
            renderTasks();
            playFeedback();
        });


        // Text Size
        document.querySelectorAll('.text-size-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const size = parseInt(btn.dataset.size);
                applyTextSize(size);
                state.ui.textSize = size;
                saveState();
                document.querySelectorAll('.text-size-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                playFeedback();
            });
        });

        // Bills
        document.getElementById('new-bill-btn')?.addEventListener('click', () => {
            openBillModal();
        });

        // Bill search (debounced for perf)
        document.getElementById('bill-search')?.addEventListener('input', debounce(() => {
            renderBills();
        }, 150));

        // Bill filters
        document.querySelectorAll('.bill-filters .filter-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                document.querySelectorAll('.bill-filters .filter-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                renderBills();
            });
        });

        // Bill customize modal
        document.getElementById('apply-customize-btn')?.addEventListener('click', async () => {
            const bill = window.currentBillForCustomize;
            if (!bill) return;
            try {
                const cardUrl = await generateBillCard(bill, getCustomizeSettings());
                shareBillCard(cardUrl, bill);
                modals.billCustomize?.close();
            } catch (err) {
                console.error('Bill PNG generation failed', err);
                if (typeof alert !== 'undefined') alert(err?.message || 'Could not generate bill image. Please try again.');
            }
        });

        document.getElementById('reset-customize-btn')?.addEventListener('click', () => {
            resetCustomizeSettings();
            if (window.currentBillForCustomize) {
                updateBillPreview(window.currentBillForCustomize);
            }
        });

        document.getElementById('preview-download-png-btn')?.addEventListener('click', async () => {
            const bill = window.currentBillForCustomize;
            if (!bill) {
                if (typeof alert !== 'undefined') alert('Download requires a bill. Try opening a bill first.');
                return;
            }
            try {
                let dataUrl = null;
                const container = document.getElementById('bill-card-preview');
                const el = container?.querySelector('.bill-preview-card') || container?.firstElementChild;
                if (el && typeof html2canvas !== 'undefined') {
                    try {
                        const canvas = await html2canvas(el, { useCORS: true, scale: 2, backgroundColor: null, logging: false });
                        dataUrl = canvas.toDataURL('image/png');
                    } catch (e) { /* fallback below */ }
                }
                if (!dataUrl) dataUrl = await generateBillCard(bill, getCustomizeSettings());
                const a = document.createElement('a');
                a.href = dataUrl;
                a.download = `bill-${bill.invoiceNumber || bill.id || 'preview'}.png`;
                a.style.display = 'none';
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
            } catch (err) {
                console.error('Preview download failed', err);
                if (typeof alert !== 'undefined') alert(err?.message || 'Download failed. If using an external logo, try removing it.');
            }
        });

        document.getElementById('preview-download-pdf-btn')?.addEventListener('click', async () => {
            const bill = window.currentBillForCustomize;
            if (!bill) {
                if (typeof alert !== 'undefined') alert('Download requires a bill. Try opening a bill first.');
                return;
            }
            try {
                await downloadBillPdf(bill, getCustomizeSettings());
            } catch (err) {
                console.error('Preview PDF download failed', err);
                if (typeof alert !== 'undefined') alert(err?.message || 'PDF download failed. If using an external logo, try removing it.');
            }
        });

        // Customize controls - Real-time preview updates
        ['customize-layout-style', 'customize-primary-color', 'customize-accent-color',
            'customize-bg-color', 'customize-font', 'customize-spacing', 'customize-border',
            'customize-border-width', 'customize-font-size', 'customize-show-icons', 'customize-notes'].forEach(id => {
                const el = document.getElementById(id);
                if (el) {
                    el.addEventListener('input', debounce(() => {
                        if (window.currentBillForCustomize) {
                            updateBillPreview(window.currentBillForCustomize);
                        }
                    }, 50));
                    el.addEventListener('change', () => {
                        if (window.currentBillForCustomize) {
                            updateBillPreview(window.currentBillForCustomize);
                        }
                    });
                }
            });

        // Font size display
        const fontSizeInput = document.getElementById('customize-font-size');
        if (fontSizeInput) {
            fontSizeInput.addEventListener('input', (e) => {
                const valueDisplay = document.getElementById('font-size-value');
                if (valueDisplay) {
                    const val = parseInt(e.target.value);
                    valueDisplay.textContent = (val >= 0 ? '+' : '') + val + 'px';
                }
            });
        }

        document.getElementById('customize-border')?.addEventListener('change', (e) => {
            const borderWidth = document.getElementById('customize-border-width');
            if (borderWidth) borderWidth.disabled = !e.target.checked;
            if (window.currentBillForCustomize) {
                updateBillPreview(window.currentBillForCustomize);
            }
        });

        document.querySelectorAll('.theme-option').forEach(btn => {
            btn.addEventListener('click', () => {
                document.querySelectorAll('.theme-option').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                applyThemePreset(btn.dataset.theme);
                if (window.currentBillForCustomize) {
                    updateBillPreview(window.currentBillForCustomize);
                }
            });
        });

        // Logo upload
        document.getElementById('customize-logo')?.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (file) {
                const reader = new FileReader();
                reader.onload = (event) => {
                    window.customizeLogoUrl = event.target.result;
                    if (window.currentBillForCustomize) {
                        updateBillPreview(window.currentBillForCustomize);
                    }
                };
                reader.readAsDataURL(file);
            }
        });

        document.getElementById('remove-logo-btn')?.addEventListener('click', () => {
            window.customizeLogoUrl = null;
            document.getElementById('customize-logo').value = '';
            if (window.currentBillForCustomize) {
                updateBillPreview(window.currentBillForCustomize);
            }
        });


        // AI Chat - Modern UI
        const aiInput = document.getElementById('ai-input');
        const aiSendBtn = document.getElementById('ai-send-btn');
        const aiVoiceBtn = document.getElementById('ai-voice-btn');
        const aiBuddyOrb = document.getElementById('ai-buddy-orb');
        const aiMessagesContainer = document.getElementById('ai-messages');
        const aiSuggestionsContainer = document.getElementById('ai-shortcuts');
        const aiLimitMessage = document.getElementById('ai-limit-message-modern');

        // Update AI buddy name display
        updateAIBuddyName();

        // Handle input (both old and new UI)
        if (aiSendBtn) {
            aiSendBtn.addEventListener('click', handleAIMessage);
        }
        if (aiInput) {
            let lastReactAt = 0;
            const syncSendDisabled = () => {
                if (!aiSendBtn) return;
                const hasText = !!aiInput.value.trim();
                aiSendBtn.disabled = aiInput.disabled || !hasText;
            };
            aiInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') handleAIMessage();
            });
            aiInput.addEventListener('input', () => {
                const now = Date.now();
                if (now - lastReactAt > 180) {
                    animateAIBuddy('react');
                    lastReactAt = now;
                }
                syncSendDisabled();
            });
            aiInput.addEventListener('focus', () => {
                animateAIBuddy('react');
            });
            syncSendDisabled();
        }
        if (aiVoiceBtn) {
            aiVoiceBtn.addEventListener('click', () => startVoiceInput('ai'));
        }

        // AI Settings button (for buddy name customization)
        document.getElementById('ai-nav-settings')?.addEventListener('click', () => {
            const newName = prompt(
                state.language === 'bn'
                    ? 'আপনার AI সহায়কের নাম কী হবে?'
                    : 'What should your AI assistant be called?',
                state.ai.buddyName || 'Assistant'
            );
            if (newName && newName.trim()) {
                state.ai.buddyName = newName.trim();
                saveState();
                updateAIBuddyName();
                playFeedback();
            }
        });

        document.getElementById('ai-upgrade-btn')?.addEventListener('click', () => {
            setActivePanel('premium');
        });

        document.getElementById('ai-paywall-upgrade-btn')?.addEventListener('click', () => {
            const modal = document.getElementById('ai-paywall-modal');
            if (modal) modal.close();
            setActivePanel('premium');
        });

        // Voice input for debt amount
        document.getElementById('debt-voice-btn')?.addEventListener('click', () => {
            startVoiceInput('debt');
        });
        document.getElementById('task-voice-btn')?.addEventListener('click', () => {
            startVoiceInput('task');
        });
        document.getElementById('quick-task-voice-btn')?.addEventListener('click', () => {
            startVoiceInput('task');
        });

        // AI Suggestions (new UI)
        document.querySelectorAll('.ai-suggestion-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const suggestion = state.language === 'bn' ? btn.dataset.suggestionBn : btn.dataset.suggestionEn;
                if (suggestion && aiInput) {
                    aiInput.value = suggestion;
                    aiInput.focus();
                    setTimeout(() => {
                        handleAIMessage();
                    }, 100);
                }
            });
        });

        // AI Shortcuts (old UI - for backward compatibility)
        document.querySelectorAll('.ai-shortcut-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const suggestion = state.language === 'bn' ? btn.dataset.suggestionBn : btn.dataset.suggestionEn;
                const fallback = btn.dataset.suggestion;
                const finalSuggestion = suggestion || fallback;
                if (finalSuggestion) {
                    const aiInput = document.getElementById('ai-input');
                    if (aiInput) {
                        aiInput.value = finalSuggestion;
                        aiInput.focus();
                        setTimeout(() => {
                            handleAIMessage();
                        }, 100);
                    }
                }
            });
        });

        // Monthly Wrap
        // Bills page customization
        const billsPageBgColor = document.getElementById('bills-page-bg-color');
        const billsPageTextColor = document.getElementById('bills-page-text-color');
        const billsTextZoom = document.getElementById('bills-text-zoom');
        const billsTextZoomValue = document.getElementById('bills-text-zoom-value');

        if (billsPageBgColor) {
            billsPageBgColor.addEventListener('input', (e) => {
                document.documentElement.style.setProperty('--bills-page-bg', e.target.value);
                localStorage.setItem('debtx-bills-bg-color', e.target.value);
            });
            const savedBg = localStorage.getItem('debtx-bills-bg-color');
            if (savedBg) {
                billsPageBgColor.value = savedBg;
                document.documentElement.style.setProperty('--bills-page-bg', savedBg);
            }
        }

        if (billsPageTextColor) {
            billsPageTextColor.addEventListener('input', (e) => {
                document.documentElement.style.setProperty('--bills-page-text', e.target.value);
                localStorage.setItem('debtx-bills-text-color', e.target.value);
            });
            const savedText = localStorage.getItem('debtx-bills-text-color');
            if (savedText) {
                billsPageTextColor.value = savedText;
                document.documentElement.style.setProperty('--bills-page-text', savedText);
            }
        }

        if (billsTextZoom && billsTextZoomValue) {
            billsTextZoom.addEventListener('input', (e) => {
                const zoom = parseFloat(e.target.value);
                billsTextZoomValue.textContent = Math.round(zoom * 100) + '%';
                document.documentElement.style.setProperty('--bills-text-zoom', zoom);
                localStorage.setItem('debtx-bills-text-zoom', zoom);
            });
            const savedZoom = localStorage.getItem('debtx-bills-text-zoom');
            if (savedZoom) {
                billsTextZoom.value = savedZoom;
                billsTextZoomValue.textContent = Math.round(parseFloat(savedZoom) * 100) + '%';
                document.documentElement.style.setProperty('--bills-text-zoom', savedZoom);
            }
        }

        document.getElementById('view-monthly-wrap-btn')?.addEventListener('click', () => {
            showMonthlyWrap();
        });

        // Update monthly wrap preview when panel is shown
        document.getElementById('nav-settings')?.addEventListener('click', () => {
            setTimeout(() => {
                // Monthly wrap preview removed with settings panel
            }, 100);
        });

        // Bill form - add product
        document.getElementById('add-product-btn')?.addEventListener('click', () => {
            addProductRow();
        });

        // Bill form - add product (inline button)
        document.getElementById('add-product-btn-inline')?.addEventListener('click', () => {
            addProductRow();
        });

        // Bill form - calculate total
        forms.bill?.addEventListener('input', calculateBillTotal);

        // Calculator
        initCalculator();

        // AI Tools tabs
        initAITools();

        // Notes/Tasks tabs
        selectors.notesTabBtn?.addEventListener('click', () => switchNotesTab('notes'));
        selectors.tasksTabBtn?.addEventListener('click', () => switchNotesTab('tasks'));

        // Customers/Debts tabs
        initDebtLedgerHandlers();


        // Logo management
        selectors.addLogoBtn?.addEventListener('click', () => {
            forms.logo?.reset();
            forms.logo.elements.logoId.value = '';
            modals.logo?.showModal();
        });
        forms.logo?.addEventListener('submit', handleLogoSubmit);

        renderLogoList();

        // Settings Handlers
        initSettingsHandlers();

        // Empty state new bill button
        const emptyNewBillBtn = document.getElementById('empty-new-bill-btn');
        if (emptyNewBillBtn) {
            emptyNewBillBtn.addEventListener('click', () => {
                openBillModal();
            });
        }

        // Premium Plan Coupon Validation
        initPremiumPlanHandlers();

        // Pricing UI handlers
        const pricingBackBtn = document.getElementById('pricing-back-btn');
        if (pricingBackBtn) {
            pricingBackBtn.addEventListener('click', () => {
                setActivePanel('settings');
            });
        }

        // Pricing period toggle
        document.querySelectorAll('.pricing-toggle-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const period = btn.dataset.period; // monthly or yearly

                // Update buttons
                document.querySelectorAll('.pricing-toggle-btn').forEach(b => {
                    b.classList.toggle('active', b.dataset.period === period);
                });

                // Show/hide relevant card containers
                const monthlyContainer = document.getElementById('pricing-monthly-cards');
                const yearlyContainer = document.getElementById('pricing-yearly-cards');

                if (period === 'monthly') {
                    if (monthlyContainer) monthlyContainer.style.display = 'grid';
                    if (yearlyContainer) yearlyContainer.style.display = 'none';
                } else {
                    if (monthlyContainer) monthlyContainer.style.display = 'none';
                    if (yearlyContainer) yearlyContainer.style.display = 'grid';
                }
                playFeedback();
            });
        });
    }

    // Premium Plan Coupon Validation
    function initPremiumPlanHandlers() {
        // Define valid coupon codes for each plan
        const validCoupons = {
            nano: ['OPTITERENCENANO'],
            pro: ['OPTIPROMAX'],
            max: ['TERENCEMAXO', 'MAX2024', 'MAX50'],
            ultra: ['TERENCEULTRAOFCL'],
            agentic_ultra: ['HELLOPIE60', 'HELLOPIE90']
        };

        // Function to validate and activate a plan
        function validateAndActivatePlan(plan) {
            playFeedback();
            const couponInput = document.getElementById(`premium-coupon-${plan}`);
            const feedbackEl = document.getElementById(`premium-feedback-${plan}`);
            const activateBtn = document.getElementById(`premium-activate-${plan}`);

            if (!couponInput || !feedbackEl || !activateBtn) return false;

            const couponCode = couponInput.value.trim().toUpperCase();
            const validCodes = validCoupons[plan] || [];

            // Clear previous feedback
            feedbackEl.textContent = '';
            feedbackEl.className = 'premium-coupon-feedback';

            // Check if coupon is valid
            if (!couponCode) {
                feedbackEl.textContent = state.language === 'bn'
                    ? 'কুপন কোড লিখুন'
                    : 'Please enter a coupon code';
                feedbackEl.classList.add('error');
                return false;
            }

            if (!validCodes.includes(couponCode)) {
                feedbackEl.textContent = state.language === 'bn'
                    ? 'অবৈধ কুপন কোড'
                    : 'Invalid coupon code';
                feedbackEl.classList.add('error');
                return false;
            }

            // Valid coupon - activate plan
            const now = Date.now();
            let expiresAt = null;

            // Monthly plans: 30 days, Annual plans: 365 days
            if (plan === 'nano' || plan === 'pro') {
                expiresAt = now + (30 * 24 * 60 * 60 * 1000);
            } else if (plan === 'agentic_ultra') {
                if (couponCode === 'HELLOPIE60') {
                    expiresAt = now + (30 * 24 * 60 * 60 * 1000);
                } else {
                    expiresAt = now + (365 * 24 * 60 * 60 * 1000);
                }
            } else {
                expiresAt = now + (365 * 24 * 60 * 60 * 1000);
            }

            // Update subscription state
            state.subscription = {
                plan: plan,
                activatedAt: now,
                expiresAt: expiresAt,
                couponUsed: couponCode
            };
            saveState();

            // Show success message
            feedbackEl.textContent = state.language === 'bn'
                ? 'প্ল্যান সক্রিয় হয়েছে!'
                : 'Plan activated successfully!';
            feedbackEl.classList.add('success');

            // Clear coupon input
            couponInput.value = '';

            // Update UI
            updatePremiumStatus();
            updatePremiumPanelStatus();
            highlightPlanCards();
            updateDockPremiumVisibility();
            applyPlanBranding();
            // Keep Settings "days left" section in sync immediately after activation.
            updateSettingsSubscriptionOverview();
            updateNewSettingsUI();
            ensureAIChatAccessible();

            playFeedbackStrong();
            return true;
        }

        // Attach event listeners to all activate buttons
        Object.keys(validCoupons).forEach(plan => {
            const activateBtn = document.getElementById(`premium-activate-${plan}`);
            if (activateBtn) {
                activateBtn.addEventListener('click', () => {
                    validateAndActivatePlan(plan);
                });
            }

            // Allow Enter key to activate
            const couponInput = document.getElementById(`premium-coupon-${plan}`);
            if (couponInput) {
                couponInput.addEventListener('keydown', (e) => {
                    if (e.key === 'Enter') validateAndActivatePlan(plan);
                });
            }
        });

        // Update premium status display
        updatePremiumStatus();
        renderPremiumPlans();

        // Plan carousel: 1 plan at a time
        initPremiumCarousel();

        // Haptic on Buy link
        document.querySelector('.premium-buy-button')?.addEventListener('click', () => playFeedback());

        // Ensure AI chat is always accessible (no restrictions for free version)
        ensureAIChatAccessible();
    }

    function initPremiumCarousel() {
        const track = document.getElementById('plan-carousel-track');
        const prev = document.getElementById('plan-carousel-prev');
        const next = document.getElementById('plan-carousel-next');
        const dots = document.querySelectorAll('.plan-carousel-dot');
        if (!track || !prev || !next) return;

        let idx = 0;
        const total = 4;

        function go(i) {
            idx = Math.max(0, Math.min(total - 1, i));
            track.style.transform = `translateX(-${idx * 100}%)`;
            dots.forEach((d, i) => d.classList.toggle('active', i === idx));
            playFeedback();
        }

        prev.addEventListener('click', () => { go(idx - 1); });
        next.addEventListener('click', () => { go(idx + 1); });
        dots.forEach(d => d.addEventListener('click', () => { go(parseInt(d.dataset.index, 10)); }));
    }

    function ensureAIChatAccessible() {
        const aiChatContainer = document.getElementById('ai-chat-container');
        if (aiChatContainer) aiChatContainer.style.display = 'flex';
        updateAIUsageUI();
        renderAIChatHistory();
    }

    function ensureProChatAccessible() {
        updateProChatUsageUI();
        renderProChatHistory();
    }

    function renderAIChatHistory() {
        const messagesContainer = document.getElementById('ai-messages');
        if (!messagesContainer) return;
        const history = Array.isArray(state.ai.chatHistory) ? state.ai.chatHistory : [];
        if (history.length === 0) return;

        messagesContainer.innerHTML = '';
        messagesContainer.hidden = false;
        history.forEach(msg => {
            if (!msg || !msg.role || !msg.content) return;
            const isUser = msg.role === 'user';
            const msgEl = document.createElement('div');
            if (messagesContainer.classList.contains('ai-chat-messages-modern')) {
                msgEl.className = isUser ? 'ai-message-modern user' : 'ai-message-modern assistant';
                msgEl.innerHTML = isUser
                    ? `
                        <div class="ai-message-avatar-modern">
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
                                <circle cx="12" cy="7" r="4"></circle>
                            </svg>
                        </div>
                        <div class="ai-message-content-modern"><p>${escapeHtml(String(msg.content))}</p></div>
                    `
                    : `
                        <div class="ai-message-avatar-modern">🤖</div>
                        <div class="ai-message-content-modern"><p style="white-space: pre-line;">${escapeHtml(String(msg.content))}</p></div>
                    `;
            } else {
                msgEl.className = isUser ? 'ai-message ai-message-user' : 'ai-message ai-message-assistant';
                msgEl.innerHTML = isUser
                    ? `
                        <div class="ai-avatar">
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
                                <circle cx="12" cy="7" r="4"></circle>
                            </svg>
                        </div>
                        <div class="ai-content"><p>${escapeHtml(String(msg.content))}</p></div>
                    `
                    : `
                        <div class="ai-avatar">
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
                                <circle cx="8.5" cy="8.5" r="1.5"></circle>
                                <polyline points="21 15 16 10 5 21"></polyline>
                            </svg>
                        </div>
                        <div class="ai-content"><p style="white-space: pre-line;">${escapeHtml(String(msg.content))}</p></div>
                    `;
            }
            messagesContainer.appendChild(msgEl);
        });
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
    }

    function renderProChatHistory() {
        const messagesContainer = document.getElementById('prochat-messages');
        if (!messagesContainer) return;
        const history = Array.isArray(state.ai.proChatHistory) ? state.ai.proChatHistory : [];
        if (history.length === 0) return;
        messagesContainer.innerHTML = '';
        history.forEach(msg => {
            if (!msg || !msg.role || !msg.content) return;
            const msgEl = document.createElement('div');
            msgEl.className = `prochat-message ${msg.role === 'user' ? 'user' : 'assistant'}`;
            msgEl.innerHTML = `
                <div class="prochat-bubble">
                    <p>${escapeHtml(String(msg.content))}</p>
                </div>
            `;
            messagesContainer.appendChild(msgEl);
        });
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
    }

    function updatePremiumStatus() {
        const currentPlanEl = document.getElementById('premium-current-plan');
        const expiryEl = document.getElementById('premium-expiry');

        if (!currentPlanEl) return;

        const subscription = state.subscription || { plan: 'free' };
        const now = Date.now();

        // Check if subscription is expired
        if (subscription.expiresAt && now > subscription.expiresAt) {
            subscription.plan = 'free';
            subscription.activatedAt = null;
            subscription.expiresAt = null;
            saveState();
        }

        const activePlan = normalizePlan(subscription.plan);
        const planNames = {
            free: state.language === 'bn' ? 'ফ্রি' : 'Free',
            nano: state.language === 'bn' ? 'ন্যানো' : 'Nano',
            pro: state.language === 'bn' ? 'প্রো' : 'Pro',
            max: state.language === 'bn' ? 'ম্যাক্স' : 'Max',
            ultra: state.language === 'bn' ? 'আল্ট্রা' : 'Ultra',
            agentic_ultra: state.language === 'bn' ? 'এজেন্টিক আল্ট্রা' : 'Agentic Ultra'
        };

        currentPlanEl.textContent = planNames[activePlan] || planNames.free;

        // Show expiry date if active subscription
        if (expiryEl && subscription.expiresAt && activePlan !== 'free') {
            const expiryDate = new Date(subscription.expiresAt);
            const expiryText = state.language === 'bn'
                ? `মেয়াদ শেষ: ${expiryDate.toLocaleDateString('bn-BD')}`
                : `Expires: ${expiryDate.toLocaleDateString('en-US')}`;
            expiryEl.textContent = expiryText;
            expiryEl.style.display = 'block';
        } else if (expiryEl) {
            expiryEl.style.display = 'none';
        }

        // Ensure AI chat is always accessible regardless of subscription
        ensureAIChatAccessible();

        // Update dock premium button visibility
        updateDockPremiumVisibility();

        // Update premium panel status if shown
        updatePremiumPanelStatus();

        // Refresh DebtX plan branding (header + settings)
        applyPlanBranding();
    }

    function renderPremiumPlans() {
        const activePlan = getActivePlan();

        // Update active state on plan cards
        document.querySelectorAll('.pricing-card-modern').forEach(card => {
            const planType = card.dataset.plan;
            if (planType === activePlan) {
                card.classList.add('is-active');
            } else {
                card.classList.remove('is-active');
            }
        });
    }

    function initSettingsHandlers() {
        // Language switching - handled in initSettingsHandlers2 to avoid duplicate listeners
        // This function is kept for other settings handlers

        // Shop Profile handlers
        const shopNameInput = document.getElementById('settings-shop-name-input');
        const ownerNameInput = document.getElementById('settings-owner-name-input');
        const phoneInput = document.getElementById('settings-phone-number');
        const paymentNumberInput = document.getElementById('settings-payment-number');
        const shopLogoInput = document.getElementById('settings-shop-logo-input');
        const myPhotoInput = document.getElementById('settings-my-photo-input');

        shopNameInput?.addEventListener('input', (e) => {
            state.shop.shopName = e.target.value;
            saveState();
        });

        ownerNameInput?.addEventListener('input', (e) => {
            state.shop.ownerName = e.target.value;
            saveState();
        });

        phoneInput?.addEventListener('input', (e) => {
            state.shop.phoneNumber = e.target.value;
            saveState();
        });

        paymentNumberInput?.addEventListener('input', (e) => {
            state.shop.paymentNumber = e.target.value;
            saveState();
        });

        shopLogoInput?.addEventListener('change', async (e) => {
            const file = e.target.files?.[0];
            if (file) {
                const dataUrl = await readFileAsDataURL(file);
                state.shop.shopLogo = dataUrl;
                saveState();
                updateShopLogoPreview();
                playFeedback();
            }
        });

        myPhotoInput?.addEventListener('change', async (e) => {
            const file = e.target.files?.[0];
            if (file) {
                const dataUrl = await readFileAsDataURL(file);
                state.shop.ownerPhoto = dataUrl;
                saveState();
                updateMyPhotoPreview();
                playFeedback();
            }
        });

        // Photo preview click handlers
        const myPhotoPreview = document.getElementById('settings-my-photo-preview');
        myPhotoPreview?.addEventListener('click', () => {
            myPhotoInput?.click();
        });

        // Payment toggles
        document.getElementById('payment-toggle-bkash')?.addEventListener('change', (e) => {
            state.shop.paymentMethods.bkash.enabled = e.target.checked;
            saveState();
            playFeedback();
        });

        document.getElementById('payment-toggle-nagad')?.addEventListener('change', (e) => {
            state.shop.paymentMethods.nagad.enabled = e.target.checked;
            saveState();
            playFeedback();
        });

        document.getElementById('payment-toggle-rocket')?.addEventListener('change', (e) => {
            state.shop.paymentMethods.rocket.enabled = e.target.checked;
            saveState();
            playFeedback();
        });

        // Theme selection
        document.querySelectorAll('.theme-appearance-tile').forEach(tile => {
            tile.addEventListener('click', () => {
                const theme = tile.dataset.theme;
                if (!theme) return;
                applyTheme(theme);

                // Update aria-checked
                document.querySelectorAll('.theme-appearance-tile').forEach(t => {
                    t.setAttribute('aria-checked', 'false');
                });
                tile.setAttribute('aria-checked', 'true');
                playFeedback();
            });
        });

        // Theme export/import
        const exportThemeBtn = document.getElementById('export-theme-btn');
        const importThemeInput = document.getElementById('import-theme-input');
        const themeExportSection = document.getElementById('theme-export-section');

        // Show theme export section for all users
        if (themeExportSection) {
            themeExportSection.style.display = 'block';
        }

        exportThemeBtn?.addEventListener('click', () => {
            exportTheme();
        });

        importThemeInput?.addEventListener('change', (e) => {
            const file = e.target.files?.[0];
            if (file) {
                importTheme(file);
            }
        });

        // Monthly wrap update when settings panel opens
        selectors.nav.settings?.addEventListener('click', () => {
            setTimeout(() => {
                updateMonthlyWrapPreview();
            }, 100);
        });

        // Initialize settings display
        updateSettingsDisplay();

        // Call additional settings handlers
        initSettingsHandlers2();

        // Also initialize language buttons in case settings panel is already visible
        initLanguageButtons();
    }

    function updateLanguageButtons() {
        document.querySelectorAll('.language-option-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.lang === state.language);
        });
    }

    function updateTextSizeButtons() {
        const currentSize = state.ui.textSize || 3;
        document.querySelectorAll('.text-size-btn').forEach(btn => {
            const size = parseInt(btn.dataset.size);
            btn.classList.toggle('active', size === currentSize);
        });
    }

    function updateDockScaleDisplay() {
        if (!selectors.dockSizeValue) return;
        const normalized = clampNumber(Number(state.ui.dockScale) || 1, 0.6, 1.15);
        if (state.ui.dockScale !== normalized) {
            state.ui.dockScale = normalized;
        }
        const value = Math.round(normalized * 100);
        selectors.dockSizeValue.textContent = `${value}%`;
    }

    function updateUiScaleDisplay() {
        if (!selectors.uiScaleValue) return;
        const value = Math.round((state.ui.uiScale || 1) * 100);
        selectors.uiScaleValue.textContent = `${value}%`;
    }

    function updateSettingsDisplay() {
        // Update shop profile fields
        const shopNameInput = document.getElementById('settings-shop-name-input');
        const ownerNameInput = document.getElementById('settings-owner-name-input');
        const phoneInput = document.getElementById('settings-phone-number');
        const paymentNumberInput = document.getElementById('settings-payment-number');

        if (shopNameInput) shopNameInput.value = state.shop.shopName || '';
        if (ownerNameInput) ownerNameInput.value = state.shop.ownerName || '';
        if (phoneInput) phoneInput.value = state.shop.phoneNumber || '';
        if (paymentNumberInput) paymentNumberInput.value = state.shop.paymentNumber || '';

        // Update payment toggles
        const bkashToggle = document.getElementById('payment-toggle-bkash');
        const nagadToggle = document.getElementById('payment-toggle-nagad');
        const rocketToggle = document.getElementById('payment-toggle-rocket');

        if (bkashToggle) bkashToggle.checked = state.shop.paymentMethods?.bkash?.enabled || false;
        if (nagadToggle) nagadToggle.checked = state.shop.paymentMethods?.nagad?.enabled || false;
        if (rocketToggle) rocketToggle.checked = state.shop.paymentMethods?.rocket?.enabled || false;

        // Update theme selection
        document.querySelectorAll('.theme-appearance-tile').forEach(tile => {
            const isActive = tile.dataset.theme === state.ui.theme;
            tile.setAttribute('aria-checked', isActive ? 'true' : 'false');
        });

        // Update language buttons
        updateLanguageButtons();

        // Update text size buttons
        updateTextSizeButtons();

        // Update dock custom slider
        if (selectors.dockSizeInput) {
            const dockScale = clampNumber(Number(state.ui.dockScale) || 1, 0.6, 1.15);
            selectors.dockSizeInput.value = dockScale;
            state.ui.dockScale = dockScale;
            applyDockScale(dockScale);
        }
        updateDockScaleDisplay();

        if (selectors.uiScaleInput) {
            const uiScale = Math.max(0.8, Math.min(1.0, Number(state.ui.uiScale) || 1));
            selectors.uiScaleInput.value = uiScale;
            applyUiScale(uiScale);
        }
        updateUiScaleDisplay();

        if (selectors.simpleTodoToggle) {
            selectors.simpleTodoToggle.checked = !!state.ui.simpleTodo;
            applyTodoMode(state.ui.simpleTodo);
        }

        // Update shop logo and photo previews
        updateShopLogoPreview();
        updateMyPhotoPreview();


        // Update monthly wrap
        updateMonthlyWrapPreview();
    }

    function updateShopLogoPreview() {
        const preview = document.getElementById('settings-shop-logo-preview');
        if (!preview) return;

        // Do not overwrite `innerHTML` here, otherwise the <input type="file"> gets removed and
        // the user can no longer change the logo after the first upload.
        let placeholder = preview.querySelector('#settings-shop-logo-placeholder');
        if (!placeholder) {
            placeholder = document.createElement('span');
            placeholder.id = 'settings-shop-logo-placeholder';
            placeholder.textContent = '🏪';
            preview.appendChild(placeholder);
        }

        let input = document.getElementById('settings-shop-logo-input');
        if (!input) {
            // Recover from older versions that replaced the preview HTML and removed the input.
            input = document.createElement('input');
            input.type = 'file';
            input.id = 'settings-shop-logo-input';
            input.accept = 'image/*';
            input.hidden = true;
            preview.appendChild(input);

            input.addEventListener('change', async (e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                const dataUrl = await readFileAsDataURL(file);
                state.shop.shopLogo = dataUrl;
                saveState();
                updateShopLogoPreview();
                playFeedback();
            });
        }

        let img = preview.querySelector('img');
        if (!img) {
            img = document.createElement('img');
            img.alt = 'Shop Logo';
            // Keep the input inside the preview; insert the image before it.
            preview.insertBefore(img, input);
        }

        if (state.shop.shopLogo) {
            img.src = state.shop.shopLogo;
            img.hidden = false;
            placeholder.hidden = true;
        } else {
            img.hidden = true;
            placeholder.hidden = false;
        }
    }

    function updateMyPhotoPreview() {
        const preview = document.getElementById('settings-my-photo-preview');
        const img = document.getElementById('settings-my-photo-img');
        const placeholder = preview?.querySelector('.photo-placeholder');

        if (!preview || !img) return;

        if (state.shop.ownerPhoto) {
            img.src = state.shop.ownerPhoto;
            img.hidden = false;
            if (placeholder) placeholder.hidden = true;
        } else {
            img.hidden = true;
            if (placeholder) placeholder.hidden = false;
        }
    }

    function updateMonthlyWrapPreview() {
        const now = new Date();
        const currentMonth = now.getMonth();
        const currentYear = now.getFullYear();

        // Calculate monthly stats
        let totalRevenue = 0;
        let paymentsReceived = 0;
        let billsGenerated = 0;
        let pendingAmount = 0;

        // Calculate from customers
        state.customers.forEach(customer => {
            customer.debts?.forEach(debt => {
                const debtDate = new Date(debt.date);
                if (debtDate.getMonth() === currentMonth && debtDate.getFullYear() === currentYear) {
                    totalRevenue += debt.amount || 0;
                }
                const outstanding = getDebtOutstanding(debt);
                if (outstanding > 0) {
                    pendingAmount += outstanding;
                }
            });

            customer.payments?.forEach(payment => {
                const paymentDate = new Date(payment.date);
                if (paymentDate.getMonth() === currentMonth && paymentDate.getFullYear() === currentYear) {
                    paymentsReceived += payment.amount || 0;
                }
            });
        });

        // Count bills
        state.bills?.forEach(bill => {
            const billDate = new Date(bill.date);
            if (billDate.getMonth() === currentMonth && billDate.getFullYear() === currentYear) {
                billsGenerated++;
            }
        });

        // Update UI
        const totalRevenueEl = document.getElementById('monthly-total-revenue');
        const paymentsReceivedEl = document.getElementById('monthly-payments-received');
        const billsGeneratedEl = document.getElementById('monthly-bills-generated');
        const pendingAmountEl = document.getElementById('monthly-pending-amount');

        if (totalRevenueEl) totalRevenueEl.textContent = formatCurrency(totalRevenue);
        if (paymentsReceivedEl) paymentsReceivedEl.textContent = formatCurrency(paymentsReceived);
        if (billsGeneratedEl) billsGeneratedEl.textContent = billsGenerated.toString();
        if (pendingAmountEl) pendingAmountEl.textContent = formatCurrency(pendingAmount);
    }

    function readFileAsDataURL(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => resolve(e.target.result);
            reader.onerror = reject;
            reader.readAsDataURL(file);
        });
    }

    function exportTheme() {
        const themeData = {
            theme: state.ui.theme,
            exportedAt: new Date().toISOString(),
            version: '1.0'
        };
        const blob = new Blob([JSON.stringify(themeData, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `debtx-theme-${state.ui.theme}.json`;
        a.click();
        URL.revokeObjectURL(url);
        playFeedback();
    }

    function importTheme(file) {
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const themeData = JSON.parse(e.target.result);
                if (themeData.theme) {
                    applyTheme(themeData.theme);
                    saveState();
                    updateSettingsDisplay();
                    playFeedback();
                    alert(translate('settings.themeImported') || 'Theme imported successfully!');
                } else {
                    alert(translate('settings.themeImportError') || 'Invalid theme file');
                }
            } catch (error) {
                alert(translate('settings.themeImportError') || 'Failed to import theme');
            }
        };
        reader.readAsText(file);
    }

    function openShopProfileModal() {
        if (!forms.shopProfile || !modals.shopProfile) return;
        forms.shopProfile.reset();
        const shop = state.shop || {};
        forms.shopProfile.elements.ownerName.value = shop.ownerName || '';
        forms.shopProfile.elements.shopName.value = shop.shopName || '';
        forms.shopProfile.elements.phoneNumber.value = shop.phoneNumber || '';
        forms.shopProfile.elements.useBkash.checked = shop.paymentMethods?.bkash?.enabled || false;
        forms.shopProfile.elements.useNagad.checked = shop.paymentMethods?.nagad?.enabled || false;
        forms.shopProfile.elements.useRocket.checked = shop.paymentMethods?.rocket?.enabled || false;
        forms.shopProfile.elements.bkashNumber.value = shop.paymentMethods?.bkash?.number || '';
        forms.shopProfile.elements.nagadNumber.value = shop.paymentMethods?.nagad?.number || '';
        forms.shopProfile.elements.rocketNumber.value = shop.paymentMethods?.rocket?.number || '';
        modals.shopProfile.showModal();
    }

    async function handleShopProfileSubmit(event) {
        event.preventDefault();
        const data = new FormData(event.target);
        state.shop = {
            ownerName: data.get('ownerName') || '',
            shopName: data.get('shopName') || '',
            phoneNumber: data.get('phoneNumber') || '',
            shopLogo: await readFileAsDataUrl(data.get('shopLogo')) || state.shop?.shopLogo || '',
            ownerPhoto: await readFileAsDataUrl(data.get('ownerPhoto')) || state.shop?.ownerPhoto || '',
            paymentMethods: {
                bkash: {
                    enabled: data.get('useBkash') === 'on',
                    number: data.get('bkashNumber') || ''
                },
                nagad: {
                    enabled: data.get('useNagad') === 'on',
                    number: data.get('nagadNumber') || ''
                },
                rocket: {
                    enabled: data.get('useRocket') === 'on',
                    number: data.get('rocketNumber') || ''
                }
            }
        };
        saveState();
        // Shop profile display removed with settings panel
        // Settings fields update removed with settings panel
        modals.shopProfile?.close();
        playFeedback();
    }

    function updateShopProfileDisplay() {
        // Update shop name input
        const shopNameInput = document.getElementById('settings-shop-name-input');
        if (shopNameInput) {
            shopNameInput.value = state.shop?.shopName || '';
        }

        // Update owner name input
        const ownerNameInput = document.getElementById('settings-owner-name-input');
        if (ownerNameInput) {
            ownerNameInput.value = state.shop?.ownerName || '';
        }

        // Update shop logo preview
        const shopLogoEl = document.getElementById('settings-shop-logo');
        if (shopLogoEl && state.shop?.shopLogo) {
            shopLogoEl.innerHTML = `<img src="${state.shop.shopLogo}" alt="">`;
        } else if (shopLogoEl) {
            shopLogoEl.textContent = (state.shop?.shopName || 'S').slice(0, 1).toUpperCase();
        }

        // Legacy display elements (if they exist)
        const shopNameEl = document.getElementById('settings-shop-name');
        const shopOwnerEl = document.getElementById('settings-shop-owner');
        if (shopNameEl) shopNameEl.textContent = state.shop?.shopName || '—';
        if (shopOwnerEl) shopOwnerEl.textContent = state.shop?.ownerName || '—';
    }

    // Separate function for language buttons initialization
    function initLanguageButtons() {
        // Remove old listeners by cloning elements
        document.querySelectorAll('.language-option-btn').forEach(btn => {
            const newBtn = btn.cloneNode(true);
            if (btn.parentNode) {
                btn.parentNode.replaceChild(newBtn, btn);
            }

            newBtn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                const lang = newBtn.dataset.lang;
                console.log('Language button clicked:', lang, 'Current:', state.language);
                if (lang) {
                    console.log('Switching language to:', lang);
                    applyLanguage(lang);
                    saveState();
                    updateLanguageButtons();
                    playFeedback();
                }
            });
        });
    }

    function initSettingsHandlers2() {
        // Language switching - Using buttons
        initLanguageButtons();

        // Text size buttons
        document.querySelectorAll('.text-size-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const size = parseInt(btn.dataset.size);
                if (size >= 1 && size <= 5) {
                    state.ui.textSize = size;
                    applyTextSize(size);
                    document.querySelectorAll('.text-size-btn').forEach(b => b.classList.remove('active'));
                    btn.classList.add('active');
                    saveState();
                    playFeedback();
                }
            });
        });

        // Dock size custom slider (no presets, just custom slider)

        // Dock size custom slider (range: 0.6 to 1.15 - compact to large)
        // #region agent log
        fetch('http://127.0.0.1:7244/ingest/7591a081-794e-4c95-addc-58f3e67a995c', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ location: 'app.js:4732', message: 'Dock slider initialization check', data: { dockSizeInputFound: !!selectors.dockSizeInput, currentScale: state.ui.dockScale }, timestamp: Date.now(), sessionId: 'debug-session', runId: 'run1', hypothesisId: 'H3' }) }).catch(() => { });
        // #endregion
        if (selectors.dockSizeInput) {
            console.log('Dock custom slider found, initializing...');
            const currentScale = clampNumber(state.ui.dockScale || 1, 0.6, 1.15);
            selectors.dockSizeInput.value = currentScale;
            applyDockScale(currentScale);
            updateDockScaleDisplay();

            // Add event listener (don't clone, just add if not already added)
            if (!selectors.dockSizeInput.hasAttribute('data-listener-attached')) {
                selectors.dockSizeInput.setAttribute('data-listener-attached', 'true');
                selectors.dockSizeInput.addEventListener('input', (event) => {
                    // #region agent log
                    fetch('http://127.0.0.1:7244/ingest/7591a081-794e-4c95-addc-58f3e67a995c', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ location: 'app.js:4742', message: 'Dock slider value changed', data: { newValue: event.target.value }, timestamp: Date.now(), sessionId: 'debug-session', runId: 'run1', hypothesisId: 'H3' }) }).catch(() => { });
                    // #endregion
                    console.log('Dock size changed:', event.target.value);
                    const value = applyDockScale(event.target.value);
                    // #region agent log
                    fetch('http://127.0.0.1:7244/ingest/7591a081-794e-4c95-addc-58f3e67a995c', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ location: 'app.js:4745', message: 'Dock scale applied', data: { appliedValue: value, cssVar: getComputedStyle(document.documentElement).getPropertyValue('--dock-scale') }, timestamp: Date.now(), sessionId: 'debug-session', runId: 'run1', hypothesisId: 'H3' }) }).catch(() => { });
                    // #endregion
                    console.log('Applied dock scale:', value);
                    state.ui.dockScale = value;
                    updateDockScaleDisplay();
                    saveState();
                });
            }
        } else {
            // #region agent log
            fetch('http://127.0.0.1:7244/ingest/7591a081-794e-4c95-addc-58f3e67a995c', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ location: 'app.js:4752', message: 'Dock slider NOT FOUND', data: {}, timestamp: Date.now(), sessionId: 'debug-session', runId: 'run1', hypothesisId: 'H3' }) }).catch(() => { });
            // #endregion
            console.log('Dock custom slider NOT found');
        }

        if (selectors.uiScaleInput) {
            const currentScale = Math.max(0.8, Math.min(1.0, state.ui.uiScale || 1));
            selectors.uiScaleInput.value = currentScale;
            applyUiScale(currentScale);
            updateUiScaleDisplay();

            if (!selectors.uiScaleInput.hasAttribute('data-listener-attached')) {
                selectors.uiScaleInput.setAttribute('data-listener-attached', 'true');
                selectors.uiScaleInput.addEventListener('input', (event) => {
                    const value = applyUiScale(event.target.value);
                    state.ui.uiScale = value;
                    updateUiScaleDisplay();
                    saveState();
                });
            }
        }

        if (selectors.simpleTodoToggle && !selectors.simpleTodoToggle.hasAttribute('data-listener-attached')) {
            selectors.simpleTodoToggle.setAttribute('data-listener-attached', 'true');
            selectors.simpleTodoToggle.addEventListener('change', (event) => {
                state.ui.simpleTodo = !!event.target.checked;
                applyTodoMode(state.ui.simpleTodo);
                saveState();
            });
        }

        // Shop name input
        const shopNameInput = document.getElementById('settings-shop-name-input');
        if (shopNameInput) {
            shopNameInput.value = state.shop?.shopName || '';
            shopNameInput.addEventListener('change', () => {
                state.shop = state.shop || {};
                state.shop.shopName = shopNameInput.value.trim();
                saveState();
                // Shop profile display removed with settings panel
            });
        }

        // Owner name input
        const ownerNameInput = document.getElementById('settings-owner-name-input');
        if (ownerNameInput) {
            ownerNameInput.value = state.shop?.ownerName || '';
            ownerNameInput.addEventListener('change', () => {
                state.shop = state.shop || {};
                state.shop.ownerName = ownerNameInput.value.trim();
                saveState();
                // Shop profile display removed with settings panel
            });
        }

        // Shop logo upload
        const shopLogoInput = document.getElementById('settings-shop-logo-input');
        const uploadShopLogoBtn = document.getElementById('upload-shop-logo-btn');
        if (shopLogoInput && uploadShopLogoBtn) {
            uploadShopLogoBtn.addEventListener('click', () => shopLogoInput.click());
            shopLogoInput.addEventListener('change', async (e) => {
                const file = e.target.files?.[0];
                if (file) {
                    const dataUrl = await readFileAsDataUrl(file);
                    state.shop = state.shop || {};
                    state.shop.shopLogo = dataUrl;
                    saveState();
                    // Shop profile display removed with settings panel
                    playFeedback();
                }
            });
        }

        // Phone number
        const phoneInput = document.getElementById('settings-phone-number');
        if (phoneInput) {
            phoneInput.value = state.shop?.phoneNumber || '';
            phoneInput.addEventListener('change', () => {
                state.shop = state.shop || {};
                state.shop.phoneNumber = phoneInput.value.trim();
                saveState();
            });
        }

        // Payment number
        const paymentNumberInput = document.getElementById('settings-payment-number');
        if (paymentNumberInput) {
            paymentNumberInput.value = state.shop?.paymentNumber || '';
            paymentNumberInput.addEventListener('change', () => {
                state.shop = state.shop || {};
                state.shop.paymentNumber = paymentNumberInput.value.trim();
                saveState();
            });
        }

        // Payment toggles
        ['bkash', 'nagad', 'rocket'].forEach(method => {
            const toggle = document.getElementById(`toggle-payment-${method}`);
            if (toggle) {
                toggle.checked = state.shop?.paymentMethods?.[method]?.enabled || false;
                toggle.addEventListener('change', () => {
                    state.shop = state.shop || {};
                    state.shop.paymentMethods = state.shop.paymentMethods || {};
                    state.shop.paymentMethods[method] = state.shop.paymentMethods[method] || {};
                    state.shop.paymentMethods[method].enabled = toggle.checked;
                    saveState();
                    playFeedback();
                });
            }
        });

        // Theme appearance tiles
        ['light', 'dark', 'custom', 'cozy'].forEach(theme => {
            const tile = document.querySelector(`.theme-appearance-tile[data-theme="${theme}"]`);
            if (tile) {
                tile.addEventListener('click', () => {
                    // Update aria-checked
                    document.querySelectorAll('.theme-appearance-tile').forEach(t => {
                        t.setAttribute('aria-checked', 'false');
                    });
                    tile.setAttribute('aria-checked', 'true');

                    // Show advanced options for custom theme
                    const advancedOptions = document.getElementById('theme-advanced-options');
                    if (advancedOptions) {
                        advancedOptions.hidden = theme !== 'custom';
                    }

                    // Apply theme preview (for now, just visual feedback)
                    playFeedback();
                });
            }
        });

        // My photo upload
        const myPhotoInput = document.getElementById('settings-my-photo-input');
        const myPhotoPreview = document.getElementById('settings-my-photo-preview');
        const myPhotoImg = document.getElementById('settings-my-photo-img');
        if (myPhotoInput && myPhotoPreview) {
            myPhotoPreview.addEventListener('click', () => myPhotoInput.click());
            myPhotoInput.addEventListener('change', async (e) => {
                const file = e.target.files?.[0];
                if (file) {
                    const dataUrl = await readFileAsDataUrl(file);
                    state.shop = state.shop || {};
                    state.shop.ownerPhoto = dataUrl;
                    if (myPhotoImg) {
                        myPhotoImg.src = dataUrl;
                        myPhotoImg.hidden = false;
                        myPhotoPreview.querySelector('.photo-placeholder').hidden = true;
                    }
                    saveState();
                    playFeedback();
                }
            });
        }

        // New Settings UI Handlers
        initNewSettingsUI();
    }

    function initNewSettingsUI() {
        // Language toggle buttons (new UI)
        document.querySelectorAll('.lang-btn-new').forEach(btn => {
            btn.addEventListener('click', () => {
                const lang = btn.dataset.lang;
                if (lang) {
                    state.language = lang;
                    applyLanguage(lang);
                    document.querySelectorAll('.lang-btn-new').forEach(b => b.classList.remove('active'));
                    btn.classList.add('active');
                    saveState();
                    playFeedback();
                }
            });
        });

        // Text size buttons (new UI)
        document.querySelectorAll('.size-btn-new').forEach(btn => {
            btn.addEventListener('click', () => {
                const size = parseInt(btn.dataset.size);
                if (size >= 1 && size <= 5) {
                    state.ui.textSize = size;
                    applyTextSize(size);
                    document.querySelectorAll('.size-btn-new').forEach(b => b.classList.remove('active'));
                    btn.classList.add('active');
                    saveState();
                    playFeedback();
                }
            });
        });

        // View mode buttons (phone / desktop)
        document.querySelectorAll('.view-btn-new').forEach(btn => {
            btn.addEventListener('click', () => {
                const view = btn.dataset.view === 'desktop' ? 'desktop' : 'phone';
                applyViewMode(view);
                document.querySelectorAll('.view-btn-new').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                saveState();
                playFeedback();
            });
        });

        // Theme tiles (new UI)
        document.querySelectorAll('.theme-tile-new').forEach(tile => {
            tile.addEventListener('click', () => {
                const theme = tile.dataset.theme;
                if (theme) {
                    state.ui.theme = theme;
                    applyTheme(theme);
                    document.querySelectorAll('.theme-tile-new').forEach(t => t.setAttribute('aria-checked', 'false'));
                    tile.setAttribute('aria-checked', 'true');
                    // Also update old theme grid if exists
                    document.querySelectorAll('.theme-appearance-tile').forEach(t => {
                        t.setAttribute('aria-checked', t.dataset.theme === theme ? 'true' : 'false');
                    });
                    saveState();
                    playFeedback();
                }
            });
        });

        // Avatar upload click
        const avatarUpload = document.querySelector('.avatar-upload-new');
        if (avatarUpload) {
            avatarUpload.addEventListener('click', () => {
                // Re-query in case the input was recreated (older versions removed it).
                document.getElementById('settings-shop-logo-input')?.click();
            });
        }

        // Upgrade plan buttons (Settings + Pro Chat lock)
        document.querySelectorAll('.upgrade-plan-btn').forEach(btn => {
            if (btn.dataset.boundUpgrade) return;
            btn.dataset.boundUpgrade = '1';
            btn.addEventListener('click', () => {
                setActivePanel('premium');
            });
        });

        // Cancel subscription buttons (new + legacy id)
        document.querySelectorAll('#settings-cancel-sub-btn, #cancel-subscription-btn').forEach(btn => {
            bindCancelSubscriptionButton(btn);
        });

        // Initialize dock premium visibility
        updateDockPremiumVisibility();

        // Update new settings UI elements
        updateNewSettingsUI();

        // Initialize new Todo UI
        initNewTodoUI();
    }

    // New Todo UI Initialization
    function initNewTodoUI() {
        // Quick add task
        const quickInput = document.getElementById('quick-task-input');
        const quickCategory = document.getElementById('quick-task-category');
        const quickAddBtn = document.getElementById('quick-add-task-btn');

        if (quickAddBtn && quickInput) {
            quickAddBtn.addEventListener('click', () => {
                addQuickTask();
            });

            quickInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    addQuickTask();
                }
            });
        }

        function addQuickTask() {
            const taskName = quickInput?.value.trim();
            const category = quickCategory?.value || 'personal';

            if (!taskName) return;

            const newTask = {
                id: generateId('task'),
                name: taskName,
                type: category,
                done: false,
                createdAt: Date.now(),
                date: new Date().toISOString().split('T')[0]
            };

            state.tasks.push(newTask);
            saveState();
            renderTasks();
            renderNewTodoList(getCurrentTodoCategory());
            renderSimpleTodoList();
            updateTodoStats();

            if (quickInput) quickInput.value = '';
            playFeedback();
        }

        // Category tab filtering
        document.querySelectorAll('.todo-tab-new').forEach(tab => {
            tab.addEventListener('click', () => {
                document.querySelectorAll('.todo-tab-new').forEach(t => t.classList.remove('active'));
                tab.classList.add('active');
                renderNewTodoList(tab.dataset.category);
            });
        });

        const todoFab = document.getElementById('todo-add-btn');
        if (todoFab) {
            todoFab.addEventListener('click', () => openTaskModalPrefill('', todayString(), '', ''));
        }

        // Initial render
        renderNewTodoList(getCurrentTodoCategory());
        updateTodoStats();

        initSimpleTodoUI();
    }

    function initSimpleTodoUI() {
        const simpleInput = document.getElementById('simple-task-input');
        const simpleAddBtn = document.getElementById('simple-add-task-btn');

        if (simpleAddBtn && simpleInput) {
            simpleAddBtn.addEventListener('click', addSimpleTask);
            simpleInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    addSimpleTask();
                }
            });
        }

        renderSimpleTodoList();

        function addSimpleTask() {
            const taskName = simpleInput?.value.trim();
            if (!taskName) return;

            const newTask = {
                id: generateId('task'),
                name: taskName,
                type: 'other',
                done: false,
                createdAt: Date.now(),
                date: new Date().toISOString().split('T')[0]
            };

            state.tasks.push(newTask);
            saveState();
            renderTasks();
            renderNewTodoList(getCurrentTodoCategory());
            renderSimpleTodoList();
            updateTodoStats();

            if (simpleInput) simpleInput.value = '';
            playFeedback();
        }
    }

    // Render new todo list
    function renderNewTodoList(filterCategory = 'all') {
        const listContainer = document.getElementById('todo-tasks-list-new');
        const emptyState = document.getElementById('todo-empty-new');

        if (!listContainer) return;

        let tasks = [...(state.tasks || [])];

        // Filter by category
        if (filterCategory !== 'all') {
            tasks = tasks.filter(task => {
                const taskCategory = task.type || 'other';
                return taskCategory === filterCategory;
            });
        }

        // Sort: incomplete first, then by date
        tasks.sort((a, b) => {
            if (a.done !== b.done) return a.done ? 1 : -1;
            return new Date(b.createdAt || 0) - new Date(a.createdAt || 0);
        });

        listContainer.innerHTML = '';

        if (tasks.length === 0) {
            if (emptyState) emptyState.removeAttribute('hidden');
            return;
        }

        if (emptyState) emptyState.setAttribute('hidden', 'hidden');

        const categoryEmojis = {
            personal: '👤',
            work: '💼',
            shopping: '🛒',
            health: '💪',
            other: '📌'
        };

        tasks.forEach(task => {
            const item = document.createElement('div');
            item.className = `todo-item-new${task.done ? ' completed' : ''}`;
            item.dataset.taskId = task.id;

            const checkbox = document.createElement('div');
            checkbox.className = `todo-checkbox-new${task.done ? ' checked' : ''}`;
            checkbox.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><path d="M20 6L9 17l-5-5"/></svg>';
            checkbox.addEventListener('click', () => toggleTaskComplete(task.id));

            const content = document.createElement('div');
            content.className = 'todo-content-new';

            const text = document.createElement('div');
            text.className = 'todo-text-new';
            text.textContent = task.name;

            const meta = document.createElement('div');
            meta.className = 'todo-meta-new';

            const categoryBadge = document.createElement('span');
            categoryBadge.className = 'todo-category-badge';
            const emoji = categoryEmojis[task.type] || categoryEmojis.other;
            categoryBadge.textContent = `${emoji} ${(task.type || 'other').charAt(0).toUpperCase() + (task.type || 'other').slice(1)}`;

            const dateBadge = document.createElement('span');
            dateBadge.className = 'todo-date-badge';
            dateBadge.textContent = task.date ? new Date(task.date).toLocaleDateString() : '';

            meta.appendChild(categoryBadge);
            if (task.date) meta.appendChild(dateBadge);

            content.appendChild(text);
            content.appendChild(meta);

            const actions = document.createElement('div');
            actions.className = 'todo-actions-new';

            const deleteBtn = document.createElement('button');
            deleteBtn.className = 'todo-action-btn delete';
            deleteBtn.innerHTML = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2"/></svg>';
            deleteBtn.addEventListener('click', () => deleteTask(task.id));

            actions.appendChild(deleteBtn);

            item.appendChild(checkbox);
            item.appendChild(content);
            item.appendChild(actions);

            listContainer.appendChild(item);
        });
    }

    function renderSimpleTodoList() {
        const listContainer = document.getElementById('todo-simple-list');
        const emptyState = document.getElementById('todo-simple-empty');

        if (!listContainer) return;

        const tasks = [...(state.tasks || [])].sort((a, b) => {
            if (a.done !== b.done) return a.done ? 1 : -1;
            return new Date(b.createdAt || 0) - new Date(a.createdAt || 0);
        });

        listContainer.innerHTML = '';

        if (tasks.length === 0) {
            if (emptyState) emptyState.removeAttribute('hidden');
            return;
        }

        if (emptyState) emptyState.setAttribute('hidden', 'hidden');

        tasks.forEach(task => {
            const item = document.createElement('div');
            item.className = `todo-simple-item${task.done ? ' done' : ''}`;
            item.dataset.taskId = task.id;

            const check = document.createElement('button');
            check.type = 'button';
            check.className = `todo-simple-check${task.done ? ' checked' : ''}`;
            check.textContent = task.done ? '✓' : '';
            check.addEventListener('click', () => toggleTaskComplete(task.id));

            const text = document.createElement('div');
            text.className = 'todo-simple-text';
            text.textContent = task.name;

            const deleteBtn = document.createElement('button');
            deleteBtn.type = 'button';
            deleteBtn.className = 'todo-simple-delete';
            deleteBtn.textContent = state.language === 'bn' ? 'মুছুন' : 'Delete';
            deleteBtn.addEventListener('click', () => deleteTask(task.id));

            item.appendChild(check);
            item.appendChild(text);
            item.appendChild(deleteBtn);

            listContainer.appendChild(item);
        });
    }

    function toggleTaskComplete(taskId) {
        const task = state.tasks.find(t => t.id === taskId);
        if (task) {
            task.done = !task.done;
            task.updatedAt = Date.now();
            saveState();
            renderTasks();
            renderNewTodoList(getCurrentTodoCategory());
            renderSimpleTodoList();
            updateTodoStats();
            playFeedback();
        }
    }

    function deleteTask(taskId) {
        const confirmMsg = state.language === 'bn' ? 'এই কাজটি মুছে ফেলতে চান?' : 'Delete this task?';
        if (confirm(confirmMsg)) {
            state.tasks = state.tasks.filter(t => t.id !== taskId);
            saveState();
            renderTasks();
            renderNewTodoList(getCurrentTodoCategory());
            renderSimpleTodoList();
            updateTodoStats();
            playFeedback();
        }
    }

    function getCurrentTodoCategory() {
        const activeTab = document.querySelector('.todo-tab-new.active');
        return activeTab?.dataset.category || 'all';
    }

    function updateTodoStats() {
        const totalEl = document.getElementById('total-tasks-count');
        const completedEl = document.getElementById('completed-tasks-count');
        const progressBar = document.getElementById('tasks-progress-bar');
        const progressPercent = document.getElementById('tasks-progress-percent');

        const total = state.tasks?.length || 0;
        const completed = state.tasks?.filter(t => t.done).length || 0;
        const percent = total > 0 ? Math.round((completed / total) * 100) : 0;

        if (totalEl) totalEl.textContent = total;
        if (completedEl) completedEl.textContent = completed;
        if (progressBar) progressBar.style.width = `${percent}%`;
        if (progressPercent) progressPercent.textContent = `${percent}%`;
    }

    function updateSettingsFields() {
        // Update phone number
        const phoneInput = document.getElementById('settings-phone-number');
        if (phoneInput) phoneInput.value = state.shop?.phoneNumber || '';

        // Update payment number
        const paymentNumberInput = document.getElementById('settings-payment-number');
        if (paymentNumberInput) paymentNumberInput.value = state.shop?.paymentNumber || '';

        // Update payment option
        const paymentOptionSelect = document.getElementById('settings-payment-option');
        if (paymentOptionSelect) paymentOptionSelect.value = state.shop?.paymentOption || 'bkash';

        // Update my photo
        const myPhotoImg = document.getElementById('settings-my-photo-img');
        const myPhotoPlaceholder = document.querySelector('#settings-my-photo-preview .photo-placeholder');
        if (state.shop?.ownerPhoto) {
            if (myPhotoImg) {
                myPhotoImg.src = state.shop.ownerPhoto;
                myPhotoImg.hidden = false;
            }
            if (myPhotoPlaceholder) myPhotoPlaceholder.hidden = true;
        } else {
            if (myPhotoImg) myPhotoImg.hidden = true;
            if (myPhotoPlaceholder) myPhotoPlaceholder.hidden = false;
        }
    }

    function updateMonthlyWrapPreview() {
        const now = new Date();
        const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
        const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);

        const monthBills = (state.bills || []).filter(b => {
            const billDate = new Date(b.date);
            return billDate >= monthStart && billDate <= monthEnd;
        });

        const monthPayments = state.customers.flatMap(c =>
            c.payments.filter(p => {
                const payDate = new Date(p.date);
                return payDate >= monthStart && payDate <= monthEnd;
            })
        );

        // Calculate pending amounts (total debts - payments)
        const totalDebts = state.customers.reduce((sum, c) => {
            return sum + (c.debts || []).reduce((debtSum, d) => debtSum + d.amount, 0);
        }, 0);
        const totalPaid = state.customers.reduce((sum, c) => {
            return sum + (c.payments || []).reduce((paySum, p) => paySum + p.amount, 0);
        }, 0);
        const pendingAmount = Math.max(0, totalDebts - totalPaid);

        const totalRevenue = monthBills.reduce((sum, b) => sum + b.total, 0);
        const totalPayments = monthPayments.reduce((sum, p) => sum + p.amount, 0);
        const totalCustomers = new Set(monthBills.map(b => b.customerName)).size;

        // Calculate performance (simple percentage of payments vs revenue)
        const performance = totalRevenue > 0 ? Math.round((totalPayments / totalRevenue) * 100) : 0;
        const performanceText = performance >= 80 ? 'Excellent' : performance >= 60 ? 'Good' : performance >= 40 ? 'Fair' : 'Needs Improvement';

        const formatCurrency = (amount) => {
            return new Intl.NumberFormat(state.language === 'bn' ? 'bn-BD' : 'en-GB', {
                style: 'currency',
                currency: 'BDT',
                minimumFractionDigits: 0
            }).format(amount).replace('BDT', '৳');
        };

        const revenueEl = document.getElementById('preview-total-revenue');
        const paymentsEl = document.getElementById('preview-total-payments');
        const pendingEl = document.getElementById('preview-pending-amount');
        const performanceEl = document.getElementById('preview-performance');

        // Legacy elements (if they exist)
        const billsEl = document.getElementById('preview-bills-count');
        const customersEl = document.getElementById('preview-customers-count');

        if (revenueEl) revenueEl.textContent = formatCurrency(totalRevenue);
        if (paymentsEl) paymentsEl.textContent = formatCurrency(totalPayments);
        if (pendingEl) pendingEl.textContent = formatCurrency(pendingAmount);
        if (performanceEl) performanceEl.textContent = performanceText;
        if (billsEl) billsEl.textContent = monthBills.length;
        if (customersEl) customersEl.textContent = totalCustomers;
    }


    function showAuthOverlay() {
        const overlay = document.getElementById('auth-overlay');
        if (overlay) {
            overlay.hidden = false;
            overlay.removeAttribute('hidden');
            document.body.classList.add('locked');
            setAuthMode(state.auth.passwordHash ? 'login' : 'setup');
        }
    }

    function openBillModal(billToEdit = null) {
        if (!forms.bill || !modals.bill) return;
        forms.bill.reset();

        // Populate customer select
        const customerSelect = document.getElementById('bill-customer-select');
        if (customerSelect) {
            customerSelect.innerHTML = '<option value="">-- Select Customer or Enter New --</option>';
            state.customers.forEach(customer => {
                const option = document.createElement('option');
                option.value = customer.id;
                option.textContent = customer.name;
                customerSelect.appendChild(option);
            });
        }

        // Set default due date to 7 days from now
        const dueDateInput = document.getElementById('bill-due-date');
        if (dueDateInput && !billToEdit) {
            const futureDate = new Date();
            futureDate.setDate(futureDate.getDate() + 7);
            dueDateInput.value = futureDate.toISOString().slice(0, 10);
        }

        // Generate invoice number if not editing
        if (!billToEdit) {
            const invoiceInput = document.querySelector('[name="invoiceNumber"]');
            if (invoiceInput && !invoiceInput.value) {
                invoiceInput.value = generateInvoiceNumber();
            }
        }

        // If editing, populate form
        if (billToEdit) {
            document.getElementById('bill-id-input').value = billToEdit.id;
            document.getElementById('bill-customer-name').value = billToEdit.customerName || '';
            if (billToEdit.customerId) {
                customerSelect.value = billToEdit.customerId;
            }
            if (billToEdit.invoiceNumber) {
                document.querySelector('[name="invoiceNumber"]').value = billToEdit.invoiceNumber;
            }
            if (billToEdit.dueDate) {
                dueDateInput.value = billToEdit.dueDate;
            }
            if (billToEdit.paymentStatus) {
                document.getElementById('bill-payment-status').value = billToEdit.paymentStatus;
            }
            if (billToEdit.notes) {
                document.querySelector('[name="notes"]').value = billToEdit.notes;
            }
            if (billToEdit.totalDiscount) {
                document.getElementById('bill-total-discount').value = billToEdit.totalDiscount;
            }
            if (billToEdit.tax) {
                document.getElementById('bill-tax').value = billToEdit.tax;
            }

            // Populate products
            const productsContainer = document.getElementById('bill-products');
            productsContainer.innerHTML = '';
            billToEdit.products.forEach(product => {
                addProductRow(product);
            });
        } else {
            document.getElementById('bill-id-input').value = '';
            document.getElementById('bill-products').innerHTML = `
                <div class="bill-product-row">
                    <input type="text" name="productName[]" placeholder="Item/Service name" required />
                    <input type="number" name="productPrice[]" placeholder="Price" min="0" step="0.01" required />
                    <input type="number" name="productQuantity[]" placeholder="Qty" min="1" value="1" required />
                    <input type="number" name="productDiscount[]" placeholder="Discount %" min="0" max="100" step="0.01" value="0" />
                    <button type="button" class="remove-product-btn" aria-label="Remove product">×</button>
                </div>
            `;
        }

        attachBillProductHandlers();
        calculateBillTotal();

        // Handle customer select change
        if (customerSelect) {
            customerSelect.addEventListener('change', (e) => {
                if (e.target.value) {
                    const customer = state.customers.find(c => c.id === e.target.value);
                    if (customer) {
                        document.getElementById('bill-customer-name').value = customer.name;
                    }
                }
            });
        }

        modals.bill.showModal();
    }

    function generateInvoiceNumber() {
        const year = new Date().getFullYear();
        const month = String(new Date().getMonth() + 1).padStart(2, '0');
        const bills = state.bills || [];
        const thisMonthBills = bills.filter(b => {
            const billDate = new Date(b.date || b.createdAt);
            return billDate.getFullYear() === year && String(billDate.getMonth() + 1).padStart(2, '0') === month;
        });
        const nextNum = (thisMonthBills.length + 1).toString().padStart(3, '0');
        return `INV-${year}${month}-${nextNum}`;
    }

    function addProductRow(product = null) {
        const container = document.getElementById('bill-products');
        const row = document.createElement('div');
        row.className = 'bill-product-row';
        row.innerHTML = `
            <input type="text" name="productName[]" placeholder="Item/Service name" value="${product?.name || ''}" required />
            <input type="number" name="productPrice[]" placeholder="Price" min="0" step="0.01" value="${product?.price || ''}" required />
            <input type="number" name="productQuantity[]" placeholder="Qty" min="1" value="${product?.quantity || 1}" required />
            <input type="number" name="productDiscount[]" placeholder="Discount %" min="0" max="100" step="0.01" value="${product?.discount || 0}" />
            <button type="button" class="remove-product-btn" aria-label="Remove product">×</button>
        `;
        container.appendChild(row);
        attachBillProductHandlers();
        if (!product) playFeedback();
    }

    function attachBillProductHandlers() {
        document.querySelectorAll('.remove-product-btn').forEach(btn => {
            btn.replaceWith(btn.cloneNode(true)); // Remove old listeners
        });
        document.querySelectorAll('.remove-product-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.target.closest('.bill-product-row').remove();
                calculateBillTotal();
                playFeedback();
            });
        });

        // Add input listeners for real-time calculation
        document.querySelectorAll('.bill-product-row input').forEach(input => {
            input.replaceWith(input.cloneNode(true)); // Remove old listeners
        });
        document.querySelectorAll('.bill-product-row input').forEach(input => {
            input.addEventListener('input', calculateBillTotal);
        });

        // Add listeners for discount and tax
        const totalDiscountInput = document.getElementById('bill-total-discount');
        const taxInput = document.getElementById('bill-tax');
        if (totalDiscountInput) {
            totalDiscountInput.replaceWith(totalDiscountInput.cloneNode(true));
            document.getElementById('bill-total-discount').addEventListener('input', calculateBillTotal);
        }
        if (taxInput) {
            taxInput.replaceWith(taxInput.cloneNode(true));
            document.getElementById('bill-tax').addEventListener('input', calculateBillTotal);
        }

        // Update spacing value display
        const spacingInput = document.getElementById('customize-spacing');
        if (spacingInput) {
            spacingInput.addEventListener('input', (e) => {
                const valueDisplay = document.getElementById('spacing-value');
                if (valueDisplay) valueDisplay.textContent = e.target.value + 'px';
            });
        }
    }

    function calculateBillTotal() {
        const totalEl = document.getElementById('bill-total-amount');
        const subtotalEl = document.getElementById('bill-subtotal');
        const discountAmountEl = document.getElementById('bill-discount-amount');
        const taxAmountEl = document.getElementById('bill-tax-amount');

        if (!totalEl) return;

        let subtotal = 0;
        document.querySelectorAll('.bill-product-row').forEach(row => {
            const price = parseFloat(row.querySelector('input[name="productPrice[]"]').value) || 0;
            const qty = parseFloat(row.querySelector('input[name="productQuantity[]"]').value) || 0;
            const itemDiscount = parseFloat(row.querySelector('input[name="productDiscount[]"]').value) || 0;
            const itemTotal = price * qty;
            const itemDiscountAmount = itemTotal * (itemDiscount / 100);
            subtotal += itemTotal - itemDiscountAmount;
        });

        if (subtotalEl) subtotalEl.textContent = formatCurrency(subtotal);

        const totalDiscount = parseFloat(document.getElementById('bill-total-discount')?.value || 0);
        const discountAmount = subtotal * (totalDiscount / 100);
        const afterDiscount = subtotal - discountAmount;

        if (discountAmountEl) discountAmountEl.textContent = formatCurrency(discountAmount);

        const tax = parseFloat(document.getElementById('bill-tax')?.value || 0);
        const taxAmount = afterDiscount * (tax / 100);
        const total = afterDiscount + taxAmount;

        if (taxAmountEl) taxAmountEl.textContent = formatCurrency(taxAmount);
        totalEl.textContent = formatCurrency(total);
    }

    async function handleBillSubmit(event) {
        event.preventDefault();
        const data = new FormData(event.target);
        const products = [];
        const productNames = data.getAll('productName[]');
        const productPrices = data.getAll('productPrice[]');
        const productQuantities = data.getAll('productQuantity[]');
        const productDiscounts = data.getAll('productDiscount[]');

        productNames.forEach((name, i) => {
            const price = parseFloat(productPrices[i]) || 0;
            const qty = parseFloat(productQuantities[i]) || 1;
            const discount = parseFloat(productDiscounts[i]) || 0;
            const itemTotal = price * qty;
            const discountAmount = itemTotal * (discount / 100);

            products.push({
                name: name.trim(),
                price: price,
                quantity: qty,
                discount: discount,
                subtotal: itemTotal - discountAmount
            });
        });

        // Calculate totals
        let subtotal = products.reduce((sum, p) => sum + p.subtotal, 0);
        const totalDiscount = parseFloat(data.get('totalDiscount') || 0);
        const discountAmount = subtotal * (totalDiscount / 100);
        const afterDiscount = subtotal - discountAmount;
        const tax = parseFloat(data.get('tax') || 0);
        const taxAmount = afterDiscount * (tax / 100);
        const total = afterDiscount + taxAmount;

        const customerId = data.get('customerId');
        const customerName = data.get('customerName') ||
            (customerId ? state.customers.find(c => c.id === customerId)?.name : '') || '';

        const bill = {
            id: data.get('billId') || generateId('bill'),
            customerId: customerId || null,
            customerName: customerName,
            invoiceNumber: data.get('invoiceNumber') || generateInvoiceNumber(),
            products: products,
            subtotal: subtotal,
            totalDiscount: totalDiscount,
            discountAmount: discountAmount,
            tax: tax,
            taxAmount: taxAmount,
            total: total,
            dueDate: data.get('dueDate') || null,
            paymentStatus: data.get('paymentStatus') || 'pending',
            notes: data.get('notes') || '',
            date: todayString(),
            createdAt: data.get('billId') ? (state.bills.find(b => b.id === data.get('billId'))?.createdAt || Date.now()) : Date.now(),
            updatedAt: Date.now()
        };

        state.bills = state.bills || [];
        const existingIndex = state.bills.findIndex(b => b.id === bill.id);
        if (existingIndex >= 0) {
            state.bills[existingIndex] = bill;
        } else {
            state.bills.unshift(bill);
        }
        saveState();
        renderBills();
        modals.bill.close();

        // Generate bill card
        const billCardUrl = await generateBillCard(bill);
        shareBillCard(billCardUrl, bill);
        playFeedback();
    }


    async function generateBillCard(bill, customizeSettings = null) {
        // New invoice-style exporter (PNG). Used for download/share.
        const settings = customizeSettings || getCustomizeSettings();

        const canvas = document.createElement('canvas');
        const scale = 3; // crisp exports

        const pageWidth = 1200;
        const margin = 90;
        const products = Array.isArray(bill.products) ? bill.products : [];

        const rowHeight = 56;
        const tableHeaderHeight = 44;
        const rows = Math.max(products.length, 1);

        // Height is based on rows so invoices don't have huge blank space.
        const baseHeight = 520 + tableHeaderHeight + (rows * rowHeight) + 360;

        canvas.width = pageWidth * scale;
        canvas.height = baseHeight * scale;

        const ctx = canvas.getContext('2d');
        ctx.scale(scale, scale);

        const themeBg = settings.bgColor || (settings.theme === 'minimal' ? '#ffffff' : '#f7f3ea');
        const bg = themeBg.toLowerCase() === '#ffffff' && settings.theme === 'cozy' ? '#f7f3ea' : themeBg;

        const ink = '#111827';
        const inkSoft = 'rgba(17, 24, 39, 0.70)';
        const line = 'rgba(17, 24, 39, 0.18)';

        ctx.fillStyle = bg;
        ctx.fillRect(0, 0, pageWidth, baseHeight);

        if (settings.showBorder) {
            ctx.strokeStyle = 'rgba(17, 24, 39, 0.08)';
            ctx.lineWidth = Math.max(1, settings.borderWidth || 1);
            ctx.strokeRect(24, 24, pageWidth - 48, baseHeight - 48);
        }

        const drawRoundedRect = (x, y, w, h, r) => {
            const radius = Math.min(r, w / 2, h / 2);
            ctx.beginPath();
            ctx.moveTo(x + radius, y);
            ctx.arcTo(x + w, y, x + w, y + h, radius);
            ctx.arcTo(x + w, y + h, x, y + h, radius);
            ctx.arcTo(x, y + h, x, y, radius);
            ctx.arcTo(x, y, x + w, y, radius);
            ctx.closePath();
        };

        const drawText = ({ text, x, y, size = 16, color = ink, align = 'left', weight = 400, family = 'Space Grotesk, ui-sans-serif, system-ui' }) => {
            ctx.fillStyle = color;
            ctx.textAlign = align;
            ctx.font = `${weight} ${size}px ${family}`;
            ctx.fillText(String(text ?? ''), x, y);
        };

        const fitText = (text, maxWidth, font) => {
            ctx.font = font;
            const str = String(text ?? '');
            if (ctx.measureText(str).width <= maxWidth) return str;
            const ellipsis = '…';
            let out = str;
            while (out.length > 0 && ctx.measureText(out + ellipsis).width > maxWidth) {
                out = out.slice(0, -1);
            }
            return (out || '').trim() ? (out.trim() + ellipsis) : ellipsis;
        };

        const logoUrl = settings.logoUrl || state.shop?.shopLogo || null;
        const logoSize = 64;
        const headerY = 96;

        if (logoUrl) {
            try {
                const logo = await loadImage(logoUrl);
                const lw = logo.naturalWidth || logo.width || 1;
                const lh = logo.naturalHeight || logo.height || 1;
                const ratio = Math.min(logoSize / lw, logoSize / lh);
                const w = Math.max(1, Math.round(lw * ratio));
                const h = Math.max(1, Math.round(lh * ratio));
                const x = margin;
                const y = headerY - logoSize + 8;
                ctx.drawImage(logo, x, y, w, h);
            } catch (e) {
                console.warn('Logo load failed', e);
            }
        }

        // INVOICE title (right)
        drawText({
            text: 'INVOICE',
            x: pageWidth - margin,
            y: headerY,
            size: 44,
            weight: 700,
            align: 'right'
        });

        // Shop name (left, under logo)
        const shopName = state.shop?.shopName || 'DebtX Shop';
        drawText({ text: shopName, x: margin, y: headerY + 38, size: 20, weight: 700, color: ink });
        if (state.shop?.phoneNumber) {
            drawText({ text: state.shop.phoneNumber, x: margin, y: headerY + 62, size: 14, color: inkSoft });
        }

        // Line under header
        ctx.strokeStyle = line;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(margin, headerY + 90);
        ctx.lineTo(pageWidth - margin, headerY + 90);
        ctx.stroke();

        // Billed to + invoice meta
        const metaTop = headerY + 130;
        drawText({ text: 'BILLED TO:', x: margin, y: metaTop, size: 12, weight: 700, color: inkSoft });
        drawText({ text: bill.customerName || 'Customer', x: margin, y: metaTop + 24, size: 18, weight: 700, color: ink });

        const invoiceNo = bill.invoiceNumber || generateInvoiceNumber();
        const dateStr = formatDisplayDate(bill.date);
        drawText({ text: `Invoice No. ${invoiceNo}`, x: pageWidth - margin, y: metaTop, size: 14, weight: 600, color: ink, align: 'right' });
        drawText({ text: dateStr, x: pageWidth - margin, y: metaTop + 22, size: 13, color: inkSoft, align: 'right' });

        // Table header
        const tableTop = metaTop + 64;
        const tableW = pageWidth - margin * 2;
        const colQty = 110;
        const colUnit = 180;
        const colTotal = 180;
        const colItem = tableW - colQty - colUnit - colTotal;
        const xItem = margin;
        const xQty = xItem + colItem;
        const xUnit = xQty + colQty;
        const xTotal = xUnit + colUnit;

        ctx.strokeStyle = line;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(margin, tableTop);
        ctx.lineTo(pageWidth - margin, tableTop);
        ctx.stroke();

        drawText({ text: 'Item', x: xItem, y: tableTop + 28, size: 13, weight: 700, color: inkSoft });
        drawText({ text: 'Qty', x: xQty + colQty / 2, y: tableTop + 28, size: 13, weight: 700, color: inkSoft, align: 'center' });
        drawText({ text: 'Unit Price', x: xUnit + colUnit - 6, y: tableTop + 28, size: 13, weight: 700, color: inkSoft, align: 'right' });
        drawText({ text: 'Total', x: xTotal + colTotal - 6, y: tableTop + 28, size: 13, weight: 700, color: inkSoft, align: 'right' });

        ctx.beginPath();
        ctx.moveTo(margin, tableTop + tableHeaderHeight);
        ctx.lineTo(pageWidth - margin, tableTop + tableHeaderHeight);
        ctx.stroke();

        const bodyFont = '500 15px Space Grotesk, ui-sans-serif, system-ui';

        let y = tableTop + tableHeaderHeight + 34;
        const safeProducts = products.length
            ? products
            : [{ name: 'Item', quantity: 1, price: bill.total || 0, subtotal: bill.total || 0 }];

        safeProducts.forEach((p) => {
            const name = fitText(p.name || 'Item', colItem - 12, bodyFont);
            const qty = Number(p.quantity) || 1;
            const unit = Number(p.price) || 0;
            const lineTotal = typeof p.subtotal === 'number' ? p.subtotal : (unit * qty);

            drawText({ text: name, x: xItem, y, size: 15, weight: 500, color: ink });
            drawText({ text: String(qty), x: xQty + colQty / 2, y, size: 13, weight: 600, color: ink, align: 'center' });
            drawText({ text: formatCurrency(unit), x: xUnit + colUnit - 6, y, size: 13, weight: 600, color: ink, align: 'right' });
            drawText({ text: formatCurrency(lineTotal), x: xTotal + colTotal - 6, y, size: 13, weight: 700, color: ink, align: 'right' });

            ctx.strokeStyle = 'rgba(17, 24, 39, 0.10)';
            ctx.beginPath();
            ctx.moveTo(margin, y + 22);
            ctx.lineTo(pageWidth - margin, y + 22);
            ctx.stroke();

            y += rowHeight;
        });

        // Totals block (right)
        const totalsTop = y + 12;
        const totalsW = 320;
        const totalsX = pageWidth - margin - totalsW;
        const totalsRight = pageWidth - margin;

        const subtotal = Number(bill.subtotal ?? bill.total ?? 0);
        const discountAmount = Number(bill.discountAmount ?? 0);
        const taxAmount = Number(bill.taxAmount ?? 0);
        const total = Number(bill.total ?? 0);

        const drawTotalRow = (label, value, rowY) => {
            drawText({ text: label, x: totalsX, y: rowY, size: 14, weight: 600, color: inkSoft });
            drawText({ text: value, x: totalsRight, y: rowY, size: 14, weight: 700, color: ink, align: 'right' });
        };

        drawTotalRow('Subtotal', formatCurrency(subtotal), totalsTop);
        let totalsY = totalsTop + 28;
        if (discountAmount > 0) {
            drawTotalRow('Discount', '-' + formatCurrency(discountAmount), totalsY);
            totalsY += 28;
        }
        if (taxAmount > 0) {
            drawTotalRow('Tax', formatCurrency(taxAmount), totalsY);
            totalsY += 28;
        }

        ctx.strokeStyle = line;
        ctx.beginPath();
        ctx.moveTo(totalsX, totalsY + 6);
        ctx.lineTo(totalsRight, totalsY + 6);
        ctx.stroke();

        drawText({ text: 'Total', x: totalsX, y: totalsY + 40, size: 18, weight: 800, color: ink });
        drawText({ text: formatCurrency(total), x: totalsRight, y: totalsY + 40, size: 18, weight: 900, color: ink, align: 'right' });

        // Footer
        const footerTop = totalsY + 110;
        drawText({ text: 'Thank you!', x: margin, y: footerTop + 44, size: 20, weight: 800, color: ink });

        // Payment information (left)
        const paymentLines = [];
        const pm = state.shop?.paymentMethods;
        if (pm?.bkash?.enabled && pm.bkash.number) paymentLines.push(`bKash: ${pm.bkash.number}`);
        if (pm?.nagad?.enabled && pm.nagad.number) paymentLines.push(`Nagad: ${pm.nagad.number}`);
        if (pm?.rocket?.enabled && pm.rocket.number) paymentLines.push(`Rocket: ${pm.rocket.number}`);

        if (paymentLines.length) {
            drawText({ text: 'PAYMENT INFORMATION', x: margin, y: footerTop + 86, size: 12, weight: 800, color: inkSoft });
            let py = footerTop + 108;
            paymentLines.forEach((lineText) => {
                drawText({ text: lineText, x: margin, y: py, size: 13, weight: 600, color: inkSoft });
                py += 18;
            });
        }

        // Notes (right)
        if (bill.notes) {
            const noteBoxW = 420;
            const noteX = pageWidth - margin - noteBoxW;
            ctx.fillStyle = 'rgba(255,255,255,0.55)';
            ctx.strokeStyle = 'rgba(17, 24, 39, 0.10)';
            ctx.lineWidth = 1;
            drawRoundedRect(noteX, footerTop + 74, noteBoxW, 100, 14);
            ctx.fill();
            ctx.stroke();
            drawText({ text: 'NOTES', x: noteX + 16, y: footerTop + 98, size: 12, weight: 800, color: inkSoft, align: 'left' });
            const note = fitText(bill.notes, noteBoxW - 32, '500 13px Space Grotesk, ui-sans-serif, system-ui');
            drawText({ text: note, x: noteX + 16, y: footerTop + 122, size: 13, weight: 500, color: inkSoft, align: 'left' });
        }

        try {
            return canvas.toDataURL('image/png', 1.0);
        } catch (e) {
            console.warn('Canvas toDataURL failed (e.g. tainted by cross-origin image).', e);
            throw new Error('Could not generate PNG. If using a logo from another website, try removing it.');
        }
    }

    function loadImage(url) {
        return new Promise((resolve, reject) => {
            const img = new Image();
            img.crossOrigin = 'anonymous';
            img.onload = () => resolve(img);
            img.onerror = reject;
            img.src = url;
        });
    }

    function openBillCustomizeModal(bill) {
        window.currentBillForCustomize = bill;
        updateBillPreview(bill);
        modals.billCustomize?.showModal();
    }

    function getCustomizeSettings() {
        return {
            theme: document.querySelector('.theme-option.active')?.dataset.theme || 'cozy',
            layoutStyle: document.getElementById('customize-layout-style')?.value || 'modern',
            primaryColor: document.getElementById('customize-primary-color')?.value || '#1c8b73',
            accentColor: document.getElementById('customize-accent-color')?.value || '#f2a03d',
            bgColor: document.getElementById('customize-bg-color')?.value || '#ffffff',
            font: document.getElementById('customize-font')?.value || 'inter',
            spacing: parseInt(document.getElementById('customize-spacing')?.value || 16),
            showBorder: document.getElementById('customize-border')?.checked !== false,
            borderWidth: parseInt(document.getElementById('customize-border-width')?.value || 2),
            logoUrl: window.customizeLogoUrl || null,
            fontSize: parseInt(document.getElementById('customize-font-size')?.value || 0),
            showIcons: document.getElementById('customize-show-icons')?.checked !== false,
            customNotes: document.getElementById('customize-notes')?.value || ''
        };
    }

    function resetCustomizeSettings() {
        document.getElementById('customize-primary-color').value = '#1c8b73';
        document.getElementById('customize-accent-color').value = '#f2a03d';
        document.getElementById('customize-bg-color').value = '#ffffff';
        document.getElementById('customize-font').value = 'inter';
        document.getElementById('customize-spacing').value = 16;
        document.getElementById('customize-border').checked = true;
        document.getElementById('customize-border-width').value = 2;
        document.getElementById('customize-font-size').value = 0;
        document.getElementById('customize-show-icons').checked = true;
        document.getElementById('customize-notes').value = '';
        document.querySelector('.theme-option[data-theme="cozy"]')?.classList.add('active');
        document.querySelectorAll('.theme-option').forEach(btn => {
            if (btn.dataset.theme !== 'cozy') btn.classList.remove('active');
        });
        window.customizeLogoUrl = null;
        const spacingValue = document.getElementById('spacing-value');
        if (spacingValue) spacingValue.textContent = '16px';
        const fontSizeValue = document.getElementById('font-size-value');
        if (fontSizeValue) fontSizeValue.textContent = '0px';
    }

    function updateBillPreview(bill) {
        const previewContainer = document.getElementById('bill-card-preview');
        if (!previewContainer || !bill) return;

        const settings = getCustomizeSettings();

        const escapeHtml = (value) => {
            const div = document.createElement('div');
            div.textContent = String(value ?? '');
            return div.innerHTML;
        };

        const bgCandidate = settings.bgColor || (settings.theme === 'minimal' ? '#ffffff' : '#f7f3ea');
        const bg = bgCandidate.toLowerCase() === '#ffffff' && settings.theme === 'cozy' ? '#f7f3ea' : bgCandidate;

        const logoUrl = settings.logoUrl || state.shop?.shopLogo || '';
        const shopName = escapeHtml(state.shop?.shopName || 'DebtX Shop');
        const phone = state.shop?.phoneNumber ? escapeHtml(state.shop.phoneNumber) : '';

        const invoiceNum = escapeHtml(bill.invoiceNumber || generateInvoiceNumber());
        const customerName = escapeHtml(bill.customerName || 'Customer');
        const dateStr = escapeHtml(formatDisplayDate(bill.date));

        const products = Array.isArray(bill.products) ? bill.products : [];
        const rows = (products.length ? products : [{ name: 'Item', quantity: 1, price: bill.total || 0, subtotal: bill.total || 0 }]).map(p => {
            const name = escapeHtml(p.name || 'Item');
            const qty = Number(p.quantity) || 1;
            const unit = Number(p.price) || 0;
            const total = typeof p.subtotal === 'number' ? p.subtotal : unit * qty;
            return `
                <tr style="border-bottom: 1px solid rgba(17,24,39,0.10);">
                    <td style="padding: 10px 8px; max-width: 260px;">${name}</td>
                    <td style="padding: 10px 8px; text-align: center;">${qty}</td>
                    <td style="padding: 10px 8px; text-align: right;">${escapeHtml(formatCurrency(unit))}</td>
                    <td style="padding: 10px 8px; text-align: right; font-weight: 800;">${escapeHtml(formatCurrency(total))}</td>
                </tr>
            `;
        }).join('');

        const subtotal = Number(bill.subtotal ?? bill.total ?? 0);
        const discountAmount = Number(bill.discountAmount ?? 0);
        const taxAmount = Number(bill.taxAmount ?? 0);
        const totalAmount = Number(bill.total ?? 0);

        const pm = state.shop?.paymentMethods;
        const payLines = [];
        if (pm?.bkash?.enabled && pm.bkash.number) payLines.push(`bKash: ${escapeHtml(pm.bkash.number)}`);
        if (pm?.nagad?.enabled && pm.nagad.number) payLines.push(`Nagad: ${escapeHtml(pm.nagad.number)}`);
        if (pm?.rocket?.enabled && pm.rocket.number) payLines.push(`Rocket: ${escapeHtml(pm.rocket.number)}`);

        const paymentInfoHtml = payLines.length ? `
            <div style="margin-top: 10px;">
                <div style="font-size: 11px; letter-spacing: 0.10em; font-weight: 900; color: rgba(17,24,39,0.65);">PAYMENT INFORMATION</div>
                ${payLines.map(l => `<div style="margin-top: 4px; font-size: 12px; color: rgba(17,24,39,0.72);">${l}</div>`).join('')}
            </div>
        ` : '';

        const notesHtml = bill.notes ? `
            <div style="margin-top: 10px;">
                <div style="font-size: 11px; letter-spacing: 0.10em; font-weight: 900; color: rgba(17,24,39,0.65);">NOTES</div>
                <div style="margin-top: 6px; font-size: 12px; color: rgba(17,24,39,0.72);">${escapeHtml(bill.notes)}</div>
            </div>
        ` : '';

        previewContainer.innerHTML = `
            <div class="bill-preview-card" style="
                background: ${bg};
                border: ${settings.showBorder ? '1px solid rgba(17,24,39,0.12)' : 'none'};
                border-radius: 18px;
                padding: 20px;
                font-family: var(--font-en);
                color: #111827;
                max-width: 100%;
                box-shadow: 0 10px 28px rgba(15, 23, 42, 0.10);
            ">
                <div style="display:flex; align-items:flex-start; justify-content:space-between; gap:16px;">
                    <div style="min-width: 72px;">
                        ${logoUrl ? `<img src="${logoUrl}" alt="Logo" style="width: 64px; height: 64px; object-fit: contain;" />` : ''}
                    </div>
                    <div style="text-align:right;">
                        <div style="font-size: 30px; font-weight: 900; letter-spacing: 0.16em;">INVOICE</div>
                        <div style="margin-top: 6px; font-size: 12px; color: rgba(17,24,39,0.70);">Invoice No. ${invoiceNum}</div>
                        <div style="font-size: 12px; color: rgba(17,24,39,0.70);">${dateStr}</div>
                    </div>
                </div>

                <div style="margin-top: 14px; border-top: 1px solid rgba(17,24,39,0.16); padding-top: 14px; display:flex; justify-content:space-between; gap:18px;">
                    <div>
                        <div style="font-size: 11px; letter-spacing: 0.10em; font-weight: 900; color: rgba(17,24,39,0.65);">BILLED TO</div>
                        <div style="margin-top: 6px; font-size: 18px; font-weight: 900;">${customerName}</div>
                    </div>
                    <div style="text-align:right;">
                        <div style="font-size: 11px; letter-spacing: 0.10em; font-weight: 900; color: rgba(17,24,39,0.65);">FROM</div>
                        <div style="margin-top: 6px; font-size: 14px; font-weight: 900;">${shopName}</div>
                        ${phone ? `<div style="font-size: 12px; color: rgba(17,24,39,0.70);">${phone}</div>` : ''}
                    </div>
                </div>

                <table style="width: 100%; border-collapse: collapse; margin-top: 16px; font-size: 13px;">
                    <thead>
                        <tr style="border-top: 1px solid rgba(17,24,39,0.18); border-bottom: 1px solid rgba(17,24,39,0.18);">
                            <th style="text-align:left; padding: 10px 8px; color: rgba(17,24,39,0.70);">Item</th>
                            <th style="text-align:center; padding: 10px 8px; color: rgba(17,24,39,0.70);">Qty</th>
                            <th style="text-align:right; padding: 10px 8px; color: rgba(17,24,39,0.70);">Unit</th>
                            <th style="text-align:right; padding: 10px 8px; color: rgba(17,24,39,0.70);">Total</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${rows}
                    </tbody>
                </table>

                <div style="display:flex; justify-content:flex-end; margin-top: 14px;">
                    <div style="width: 280px;">
                        <div style="display:flex; justify-content:space-between; font-size: 12px; color: rgba(17,24,39,0.70);">
                            <span>Subtotal</span>
                            <strong style="color:#111827;">${escapeHtml(formatCurrency(subtotal))}</strong>
                        </div>
                        ${discountAmount > 0 ? `<div style="margin-top:6px; display:flex; justify-content:space-between; font-size: 12px; color: rgba(17,24,39,0.70);">
                            <span>Discount</span>
                            <strong style="color:#111827;">-${escapeHtml(formatCurrency(discountAmount))}</strong>
                        </div>` : ''}
                        ${taxAmount > 0 ? `<div style="margin-top:6px; display:flex; justify-content:space-between; font-size: 12px; color: rgba(17,24,39,0.70);">
                            <span>Tax</span>
                            <strong style="color:#111827;">${escapeHtml(formatCurrency(taxAmount))}</strong>
                        </div>` : ''}
                        <div style="margin-top: 10px; padding-top: 10px; border-top: 1px solid rgba(17,24,39,0.18); display:flex; justify-content:space-between; font-size: 16px; font-weight: 900;">
                            <span>Total</span>
                            <span>${escapeHtml(formatCurrency(totalAmount))}</span>
                        </div>
                    </div>
                </div>

                <div style="margin-top: 14px; border-top: 1px solid rgba(17,24,39,0.16); padding-top: 12px; display:flex; justify-content:space-between; gap:18px;">
                    <div>
                        <div style="font-size: 16px; font-weight: 900;">Thank you!</div>
                        ${paymentInfoHtml}
                    </div>
                    <div style="text-align:right; max-width: 46%;">
                        ${notesHtml}
                    </div>
                </div>
            </div>
        `;
    }


    async function shareBillCard(dataUrl, bill) {
        if (!dataUrl || typeof dataUrl !== 'string') return;
        try {
            if (navigator.share) {
                const file = await dataUrlToFile(dataUrl, `bill-${bill.invoiceNumber || bill.id}.png`);
                await navigator.share({ files: [file], text: `Bill for ${bill.customerName} - ${formatCurrency(bill.total)}` });
            } else {
                const file = await dataUrlToFile(dataUrl, `bill-${bill.invoiceNumber || bill.id}.png`);
                const url = URL.createObjectURL(file);
                const link = document.createElement('a');
                link.href = url;
                link.download = `bill-${bill.invoiceNumber || bill.id}.png`;
                link.style.display = 'none';
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
                URL.revokeObjectURL(url);
            }
        } catch (error) {
            console.error('Share failed', error);
            try {
                const link = document.createElement('a');
                link.href = dataUrl;
                link.download = `bill-${bill.invoiceNumber || bill.id}.png`;
                link.style.display = 'none';
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
            } catch (e2) {
                if (typeof alert !== 'undefined') alert('Download failed. Please try again.');
            }
        }
    }

    function renderBills() {
        const billsList = document.getElementById('bills-list');
        const billsEmpty = document.getElementById('bills-empty');
        if (!billsList) return;

        billsList.innerHTML = '';
        let bills = state.bills || [];

        // Calculate stats
        const totalBills = bills.length;
        const paidBills = bills.filter(b => b.paymentStatus === 'paid').length;
        const pendingBills = bills.filter(b => (b.paymentStatus === 'pending' || !b.paymentStatus) && (!b.dueDate || b.dueDate >= todayString())).length;
        const overdueBills = bills.filter(b => {
            const isPending = b.paymentStatus === 'pending' || !b.paymentStatus;
            const isOverdue = b.dueDate && b.dueDate < todayString();
            return isPending && isOverdue;
        }).length;

        // Update stats
        updateBillsStats(totalBills, paidBills, pendingBills, overdueBills);

        // Apply search filter
        const searchInput = document.getElementById('bill-search');
        const searchQuery = searchInput?.value.toLowerCase().trim() || '';
        if (searchQuery) {
            bills = bills.filter(bill =>
                bill.customerName?.toLowerCase().includes(searchQuery) ||
                bill.invoiceNumber?.toLowerCase().includes(searchQuery) ||
                bill.notes?.toLowerCase().includes(searchQuery)
            );
        }

        // Apply status filter
        const activeFilter = document.querySelector('.bill-filters .filter-btn.active')?.dataset.filter;
        if (activeFilter && activeFilter !== 'all') {
            const today = todayString();
            bills = bills.filter(bill => {
                if (activeFilter === 'paid') return bill.paymentStatus === 'paid';
                if (activeFilter === 'pending') {
                    const isPending = bill.paymentStatus === 'pending' || !bill.paymentStatus;
                    return isPending && (!bill.dueDate || bill.dueDate >= today);
                }
                if (activeFilter === 'overdue') {
                    const isPending = bill.paymentStatus === 'pending' || !bill.paymentStatus;
                    return isPending && bill.dueDate && bill.dueDate < today;
                }
                return true;
            });
        }

        // Sort by date (newest first)
        bills.sort((a, b) => {
            const dateA = new Date(a.date || a.createdAt || 0);
            const dateB = new Date(b.date || b.createdAt || 0);
            return dateB - dateA;
        });

        if (bills.length === 0) {
            billsEmpty?.removeAttribute('hidden');
            return;
        }

        billsEmpty?.setAttribute('hidden', 'hidden');

        // Render bill cards
        bills.forEach(bill => {
            const card = document.createElement('article');
            card.className = 'customer-card bill-card-enhanced';
            card.dataset.billId = bill.id;

            const isOverdue = bill.dueDate && bill.dueDate < todayString() &&
                (bill.paymentStatus === 'pending' || !bill.paymentStatus);
            const statusClass = bill.paymentStatus === 'paid' ? 'status-paid' :
                bill.paymentStatus === 'partial' ? 'status-partial' :
                    isOverdue ? 'status-overdue' : 'status-pending';

            const statusText = bill.paymentStatus === 'paid' ? translate('bills.filterPaid') :
                bill.paymentStatus === 'partial' ? translate('modals.bill.statusPartial') :
                    isOverdue ? translate('bills.filterOverdue') : translate('bills.filterPending');

            const unknownCustomer = translate('modals.bill.customerName') || 'Unknown Customer';
            const noInvoice = translate('bills.invoiceNumber') || 'No Invoice #';
            const dueLabel = translate('bills.dueDate') || 'Due';
            const totalLabel = translate('bills.totalAmount') || 'Total';
            const itemsLabel = translate('bills.items') || 'Items';
            const discountLabel = translate('modals.bill.discount') || 'Discount';
            const taxLabel = translate('modals.bill.tax') || 'Tax';
            const dateLabel = translate('bills.date') || 'Date';

            // Get customer initial for icon
            const customerName = bill.customerName || unknownCustomer;
            const iconLetter = customerName.charAt(0).toUpperCase();
            const iconColor = getColorForLetter(iconLetter);

            card.innerHTML = `
                <header class="bill-card-header-enhanced">
                    <div class="bill-customer-info">
                        <div class="bill-customer-icon" style="background: ${iconColor};">
                            ${iconLetter}
                        </div>
                        <div class="bill-customer-details">
                            <h2 class="bill-customer-name">${customerName}</h2>
                            <p class="bill-invoice-info">${bill.invoiceNumber || noInvoice} • ${formatDisplayDate(bill.date)}</p>
                        </div>
                    </div>
                    <span class="status-badge-enhanced ${statusClass}">${statusText}</span>
                </header>
                <div class="bill-card-body-enhanced">
                    <div class="bill-amount-section">
                        <div class="bill-amount-main">
                            <span class="bill-amount-label">${totalLabel}</span>
                            <strong class="bill-amount-value">${formatCurrency(bill.total || 0)}</strong>
                        </div>
                        ${bill.dueDate ? `
                            <div class="bill-due-info ${isOverdue ? 'overdue' : ''}">
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                    <circle cx="12" cy="12" r="10"></circle>
                                    <path d="M12 6v6l4 2"></path>
                                </svg>
                                <span>${dueLabel}: ${formatDisplayDate(bill.dueDate)}</span>
                            </div>
                        ` : ''}
                    </div>
                    <div class="bill-meta-enhanced">
                        <div class="bill-meta-item">
                            <span class="meta-label">${itemsLabel}</span>
                            <span class="meta-value">${bill.products?.length || 0}</span>
                        </div>
                        ${bill.discountAmount > 0 ? `
                            <div class="bill-meta-item">
                                <span class="meta-label">${discountLabel}</span>
                                <span class="meta-value discount">-${formatCurrency(bill.discountAmount)}</span>
                            </div>
                        ` : ''}
                        ${bill.taxAmount > 0 ? `
                            <div class="bill-meta-item">
                                <span class="meta-label">${taxLabel}</span>
                                <span class="meta-value">${formatCurrency(bill.taxAmount)}</span>
                            </div>
                        ` : ''}
                    </div>
                    ${bill.notes ? `<p class="bill-notes-enhanced">${escapeHtml(bill.notes)}</p>` : ''}
                </div>
                <footer class="bill-card-footer-enhanced">
                    <button class="bill-action-btn secondary" data-action="edit" title="${translate('actions.edit')}">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                        </svg>
                        <span>${translate('actions.edit')}</span>
                    </button>
                    <button class="bill-action-btn secondary" data-action="duplicate" title="${translate('bills.duplicate')}">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                        </svg>
                        <span>${translate('bills.duplicate')}</span>
                    </button>
                    <button class="bill-action-btn secondary" data-action="view" title="${translate('bills.view')}">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                            <circle cx="12" cy="12" r="3"></circle>
                        </svg>
                        <span>${translate('bills.view')}</span>
                    </button>
                    <button class="bill-action-btn secondary" data-action="make-invoice" title="${translate('bills.makeInvoice')}">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                            <polyline points="14 2 14 8 20 8"></polyline>
                            <line x1="16" y1="13" x2="8" y2="13"></line>
                            <line x1="16" y1="17" x2="8" y2="17"></line>
                        </svg>
                        <span>${translate('bills.makeInvoice')}</span>
                    </button>
                    <button class="bill-action-btn secondary" data-action="download-png" title="${translate('bills.downloadPng')}">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                            <polyline points="7 10 12 15 17 10"></polyline>
                            <line x1="12" y1="15" x2="12" y2="3"></line>
                        </svg>
                        <span>${translate('bills.downloadPng')}</span>
                    </button>
                    <button class="bill-action-btn secondary" data-action="download-pdf" title="${translate('bills.downloadPdf')}">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                            <polyline points="14 2 14 8 20 8"></polyline>
                            <path d="M12 12v6"></path>
                            <path d="M9 15l3 3 3-3"></path>
                        </svg>
                        <span>${translate('bills.downloadPdf')}</span>
                    </button>
                    <button class="bill-action-btn primary" data-action="share" title="${translate('bills.share')}">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <circle cx="18" cy="5" r="3"></circle>
                            <circle cx="6" cy="12" r="3"></circle>
                            <circle cx="18" cy="19" r="3"></circle>
                            <line x1="8.59" y1="13.51" x2="15.42" y2="17.49"></line>
                            <line x1="15.41" y1="6.51" x2="8.59" y2="10.49"></line>
                        </svg>
                        <span>${translate('bills.share')}</span>
                    </button>
                </footer>
            `;

            // Attach event handlers
            card.querySelector('[data-action="edit"]')?.addEventListener('click', (e) => {
                e.stopPropagation();
                openBillModal(bill);
            });
            card.querySelector('[data-action="duplicate"]')?.addEventListener('click', (e) => {
                e.stopPropagation();
                const duplicate = { ...bill, id: generateId('bill'), invoiceNumber: generateInvoiceNumber(), date: todayString(), createdAt: Date.now() };
                state.bills.unshift(duplicate);
                saveState();
                renderBills();
                playFeedback();
            });
            card.querySelector('[data-action="view"]')?.addEventListener('click', (e) => {
                e.stopPropagation();
                openBillCustomizeModal(bill);
            });
            card.querySelector('[data-action="make-invoice"]')?.addEventListener('click', (e) => {
                e.stopPropagation();
                openBillCustomizeModal(bill);
                playFeedback();
            });
            card.querySelector('[data-action="download-png"]')?.addEventListener('click', async (e) => {
                e.stopPropagation();
                try {
                    const cardUrl = await generateBillCard(bill);
                    const a = document.createElement('a');
                    a.href = cardUrl;
                    a.download = `bill-${bill.invoiceNumber || bill.id}.png`;
                    a.style.display = 'none';
                    document.body.appendChild(a);
                    a.click();
                    document.body.removeChild(a);
                    playFeedback();
                } catch (err) {
                    console.error('Bill PNG download failed', err);
                    if (typeof alert !== 'undefined') alert(err?.message || 'Could not generate bill image. Please try again.');
                }
            });
            card.querySelector('[data-action="download-pdf"]')?.addEventListener('click', async (e) => {
                e.stopPropagation();
                try {
                    await downloadBillPdf(bill, getCustomizeSettings());
                    playFeedback();
                } catch (err) {
                    console.error('Bill PDF download failed', err);
                    if (typeof alert !== 'undefined') alert(err?.message || 'Could not generate bill PDF. Please try again.');
                }
            });
            card.querySelector('[data-action="share"]')?.addEventListener('click', async (e) => {
                e.stopPropagation();
                try {
                    const cardUrl = await generateBillCard(bill);
                    shareBillCard(cardUrl, bill);
                } catch (err) {
                    console.error('Bill PNG generation failed', err);
                    if (typeof alert !== 'undefined') alert(err?.message || 'Could not generate bill image. Please try again.');
                }
            });

            billsList.appendChild(card);
        });
    }

    function updateBillsStats(total, paid, pending, overdue) {
        const totalEl = document.getElementById('bills-total-count');
        const paidEl = document.getElementById('bills-paid-count');
        const pendingEl = document.getElementById('bills-pending-count');
        const overdueEl = document.getElementById('bills-overdue-count');

        if (totalEl) totalEl.textContent = total;
        if (paidEl) paidEl.textContent = paid;
        if (pendingEl) pendingEl.textContent = pending;
        if (overdueEl) overdueEl.textContent = overdue;
    }

    function updateBillsSummary(inflow, outflow, balance) {
        const balanceEl = document.getElementById('bills-balance-amount');
        const inflowEl = document.getElementById('bills-inflow-amount');
        const outflowEl = document.getElementById('bills-outflow-amount');

        if (balanceEl) balanceEl.textContent = formatCurrency(balance);
        if (inflowEl) inflowEl.textContent = `+${formatCurrency(inflow)}`;
        if (outflowEl) outflowEl.textContent = `-${formatCurrency(outflow)}`;

        // Update donut chart
        const total = inflow + outflow;
        if (total > 0) {
            const outflowPercent = (outflow / total) * 100;
            const inflowPercent = (inflow / total) * 100;
            const circumference = 2 * Math.PI * 80; // radius = 80

            const outflowDash = (outflowPercent / 100) * circumference;
            const inflowDash = (inflowPercent / 100) * circumference;

            const outflowCircle = document.getElementById('donut-outflow');
            const inflowCircle = document.getElementById('donut-inflow');

            if (outflowCircle) {
                outflowCircle.style.strokeDasharray = `${outflowDash} ${circumference}`;
            }
            if (inflowCircle) {
                inflowCircle.style.strokeDasharray = `${inflowDash} ${circumference}`;
                inflowCircle.style.strokeDashoffset = `-${outflowDash}`;
            }
        } else {
            const outflowCircle = document.getElementById('donut-outflow');
            const inflowCircle = document.getElementById('donut-inflow');
            if (outflowCircle) outflowCircle.style.strokeDasharray = '0 502.65';
            if (inflowCircle) inflowCircle.style.strokeDasharray = '0 502.65';
        }
    }

    function getColorForLetter(letter) {
        const colors = [
            '#EF4444', '#F59E0B', '#10B981', '#3B82F6',
            '#8B5CF6', '#EC4899', '#06B6D4', '#F97316'
        ];
        const index = letter.charCodeAt(0) % colors.length;
        return colors[index];
    }

    function normalizeBanglaDigits(text) {
        const map = {
            '০': '0', '১': '1', '২': '2', '৩': '3', '৪': '4',
            '৫': '5', '৬': '6', '৭': '7', '৮': '8', '৯': '9'
        };
        return text.replace(/[০-৯]/g, (digit) => map[digit] || digit);
    }

    function normalizeText(text) {
        return normalizeBanglaDigits(text).toLowerCase();
    }

    function getAIUsageInfo() {
        const plan = getActivePlan();
        // Limits: 
        // Free = 20/month
        // Nano = 5/day
        // Pro = 100/month
        // Max = 100/year (effectively per cycle if cycle is year, but let's assume year)
        // Ultra = 200/year
        // Agentic Ultra = 200/month or 1000/year depending on cycle

        let limit = 20; // Default (Free)
        let cycle = 'month';

        if (plan === 'nano') { limit = 5; cycle = 'day'; }
        else if (plan === 'pro') { limit = 100; cycle = 'month'; }
        else if (plan === 'max') { limit = 100; cycle = 'year'; }
        else if (plan === 'ultra') { limit = 200; cycle = 'year'; }
        else if (plan === 'agentic_ultra') {
            // Check if monthly or yearly based on expiry duration
            const sub = state.subscription;
            // If expiry is > 40 days away from activation, it's roughly a year. 
            // Or simpler: check coupon used.
            if (sub && sub.couponUsed === 'HELLOPIE90') {
                limit = 1000; cycle = 'year';
            } else {
                limit = 200; cycle = 'month';
            }
        }

        const now = new Date();
        let windowKey = '';
        if (cycle === 'day') {
            windowKey = todayString();
        } else if (cycle === 'month') {
            windowKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
        } else {
            // Year
            windowKey = `${now.getFullYear()}`;
        }
        const lastKey = state.ai.lastUsageKey || state.ai.lastUsageDate;

        if (lastKey !== windowKey || state.ai.lastUsagePlan !== plan) {
            state.ai.usageCount = 0;
            state.ai.lastUsageKey = windowKey;
            state.ai.lastUsagePlan = plan;
            state.ai.lastUsageDate = windowKey;
            saveState();
        }

        const used = Number(state.ai.usageCount) || 0;
        const remaining = limit === Infinity ? Infinity : Math.max(0, limit - used);
        return { plan, limit, used, remaining, windowKey, cycle };
    }

    function getProChatUsageInfo() {
        const plan = getActivePlan();
        let limit = 0;
        let cycle = 'month';

        if (plan === 'nano' || plan === 'pro') {
            limit = 2;
            cycle = 'day';
        } else if (plan === 'max' || plan === 'ultra' || plan === 'agentic_ultra') {
            limit = 100;
            cycle = 'month';
        } else {
            limit = 0;
            cycle = 'month';
        }

        const now = new Date();
        let windowKey = '';
        if (cycle === 'day') {
            windowKey = todayString();
        } else if (cycle === 'month') {
            windowKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
        } else {
            windowKey = `${now.getFullYear()}`;
        }

        const lastKey = state.ai.proChatUsageKey || state.ai.proChatUsageDate;
        if (lastKey !== windowKey || state.ai.proChatUsagePlan !== plan) {
            state.ai.proChatUsageCount = 0;
            state.ai.proChatUsageKey = windowKey;
            state.ai.proChatUsagePlan = plan;
            state.ai.proChatUsageDate = windowKey;
            saveState();
        }

        const used = Number(state.ai.proChatUsageCount) || 0;
        const remaining = limit === Infinity ? Infinity : Math.max(0, limit - used);
        return { plan, limit, used, remaining, windowKey, cycle };
    }

    function consumeProChatUsage() {
        const info = getProChatUsageInfo();
        if (info.limit <= 0) {
            return { allowed: false, info, message: buildLimitMessage(info, 'Pro Chat') };
        }
        if (info.limit !== Infinity && info.remaining <= 0) {
            return { allowed: false, info, message: buildLimitMessage(info, 'Pro Chat') };
        }
        if (info.limit !== Infinity) {
            state.ai.proChatUsageCount += 1;
            saveState();
            info.used = state.ai.proChatUsageCount;
            info.remaining = Math.max(0, info.limit - info.used);
        }
        return { allowed: true, info };
    }

    function updateProChatUsageUI(usageInfo) {
        const info = usageInfo || getProChatUsageInfo();
        const isBangla = state.language === 'bn';
        const planLabels = {
            free: isBangla ? 'ফ্রি' : 'Free',
            nano: isBangla ? 'ন্যানো' : 'Nano',
            pro: isBangla ? 'প্রো' : 'Pro',
            max: isBangla ? 'ম্যাক্স' : 'Max',
            ultra: isBangla ? 'আল্ট্রা' : 'Ultra',
            agentic_ultra: isBangla ? 'এজেন্টিক আল্ট্রা' : 'Agentic Ultra'
        };

        const planEl = document.getElementById('prochat-usage-plan');
        const countEl = document.getElementById('prochat-usage-count');
        const hintEl = document.getElementById('prochat-usage-hint');
        const barEl = document.getElementById('prochat-usage-bar');
        const lockEl = document.getElementById('prochat-lock');
        const inputEl = document.getElementById('prochat-input');
        const sendBtn = document.getElementById('prochat-send-btn');
        const noApiBadge = document.getElementById('prochat-noapi-badge');

        const cycle = info?.cycle === 'day' || info?.cycle === 'month' || info?.cycle === 'year'
            ? info.cycle
            : 'month';
        const resetEn = cycle === 'day' ? 'Resets daily' : (cycle === 'year' ? 'Resets yearly' : 'Resets monthly');
        const resetBn = cycle === 'day' ? 'প্রতিদিন রিসেট' : (cycle === 'year' ? 'প্রতি বছরে রিসেট' : 'প্রতি মাসে রিসেট');

        if (planEl) planEl.textContent = planLabels[info.plan] || planLabels.free;
        if (countEl) {
            if (info.limit === Infinity) {
                countEl.textContent = isBangla ? 'আনলিমিটেড' : 'Unlimited';
            } else {
                countEl.textContent = `${info.used}/${info.limit}`;
            }
        }
        if (hintEl) hintEl.textContent = isBangla ? resetBn : resetEn;
        if (barEl) {
            if (info.limit === Infinity || info.limit === 0) {
                barEl.style.width = '0%';
            } else {
                const percent = Math.min(100, (info.used / info.limit) * 100);
                barEl.style.width = `${percent}%`;
            }
        }

        if (noApiBadge) noApiBadge.style.display = hasDeepSeekKey() ? 'none' : 'inline-flex';

        const locked = info.limit <= 0 || !hasDeepSeekKey();
        if (lockEl) lockEl.hidden = !locked;
        if (inputEl) inputEl.disabled = locked || (info.limit !== Infinity && info.remaining <= 0);
        if (sendBtn) sendBtn.disabled = locked || (info.limit !== Infinity && info.remaining <= 0);
    }

    function buildLimitMessage(info, label = 'AI') {
        const isBangla = state.language === 'bn';
        const cycle = info?.cycle === 'day' || info?.cycle === 'month' || info?.cycle === 'year'
            ? info.cycle
            : 'month';
        const periodEn = cycle === 'day' ? 'today' : (cycle === 'year' ? 'this year' : 'this month');
        const periodBn = cycle === 'day' ? 'আজকের' : (cycle === 'year' ? 'এই বছরের' : 'এই মাসের');
        const resetEn = cycle === 'day' ? 'Resets daily' : (cycle === 'year' ? 'Resets yearly' : 'Resets monthly');
        const resetBn = cycle === 'day' ? 'প্রতিদিন রিসেট' : (cycle === 'year' ? 'প্রতি বছরে রিসেট' : 'প্রতি মাসে রিসেট');
        return isBangla
            ? `${periodBn} ${label} লিমিট শেষ হয়েছে। ${resetBn}।`
            : `You have reached your ${label} limit for ${periodEn}. ${resetEn}.`;
    }

    function consumeAIUsage() {
        const info = getAIUsageInfo();
        if (info.limit !== Infinity && info.remaining <= 0) {
            return { allowed: false, info, message: buildLimitMessage(info, 'AI') };
        }
        if (info.limit !== Infinity) {
            state.ai.usageCount += 1;
            saveState();
            info.used = state.ai.usageCount;
            info.remaining = Math.max(0, info.limit - info.used);
        }
        return { allowed: true, info };
    }

    function updateAIBuddyName() {
        const buddyName = state.ai.buddyName || 'Assistant';
        const buddyNameEn = document.getElementById('ai-buddy-name-display');
        const buddyNameBn = document.getElementById('ai-buddy-name-display-bn');
        if (buddyNameEn) buddyNameEn.textContent = buddyName;
        if (buddyNameBn) {
            // Simple transliteration for common names, or use the name as-is
            buddyNameBn.textContent = buddyName;
        }
    }

    function animateAIBuddy(state) {
        const orb = document.getElementById('ai-buddy-orb');
        if (!orb) return;

        orb.classList.remove('listening', 'thinking', 'happy', 'react');

        // Force reflow for animation restart if needed
        if (state === 'happy' || state === 'react') {
            void orb.offsetWidth;
        }

        if (state === 'listening') {
            orb.classList.add('listening');
        } else if (state === 'thinking') {
            orb.classList.add('thinking');
        } else if (state === 'happy') {
            orb.classList.add('happy');
            setTimeout(() => orb.classList.remove('happy'), 1000);
        } else if (state === 'react') {
            orb.classList.add('react');
            setTimeout(() => orb.classList.remove('react'), 500);
        }
    }

    function speakText(text, lang) {
        if (!('speechSynthesis' in window)) return;

        // Cancel any ongoing speech
        window.speechSynthesis.cancel();

        const utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = lang === 'bn' ? 'bn-BD' : 'en-US';
        utterance.rate = 0.9;
        utterance.pitch = 1.0;
        utterance.volume = 0.8;

        utterance.onstart = () => {
            animateAIBuddy('thinking');
        };

        utterance.onend = () => {
            animateAIBuddy('idle');
        };

        window.speechSynthesis.speak(utterance);
    }

    function updateAIUsageUI(usageInfo) {
        const info = usageInfo || getAIUsageInfo();
        const isBangla = state.language === 'bn';
        const planLabel = info.plan === 'agentic_ultra'
            ? (isBangla ? 'এজেন্টিক আল্ট্রা' : 'Agentic Ultra')
            : info.plan === 'ultra'
                ? (isBangla ? 'আল্ট্রা' : 'Ultra')
                : info.plan === 'max'
                    ? (isBangla ? 'ম্যাক্স' : 'Max')
                    : info.plan === 'free'
                        ? (isBangla ? 'ফ্রি' : 'Free')
                        : (info.plan.charAt(0).toUpperCase() + info.plan.slice(1));

        const planEl = document.getElementById('ai-usage-plan');
        const countEl = document.getElementById('ai-usage-count');
        const hintEl = document.getElementById('ai-usage-hint');
        const barEl = document.getElementById('ai-usage-bar');
        const limitMessage = document.getElementById('ai-limit-message');
        const limitMessageModern = document.getElementById('ai-limit-message-modern');
        const limitTitle = limitMessage?.querySelector('h3');
        const limitBody = limitMessage?.querySelector('p');
        const inputEl = document.getElementById('ai-input');
        const sendBtn = document.getElementById('ai-send-btn');
        const voiceBtn = document.getElementById('ai-voice-btn');

        const cycle = info?.cycle === 'day' || info?.cycle === 'month' || info?.cycle === 'year'
            ? info.cycle
            : 'month';
        const periodEn = cycle === 'day' ? 'today' : (cycle === 'year' ? 'this year' : 'this month');
        const periodBn = cycle === 'day' ? 'আজকে' : (cycle === 'year' ? 'এই বছরে' : 'এই মাসে');
        const resetEn = cycle === 'day' ? 'Resets daily' : (cycle === 'year' ? 'Resets yearly' : 'Resets monthly');
        const resetBn = cycle === 'day' ? 'প্রতিদিন রিসেট' : (cycle === 'year' ? 'প্রতি বছরে রিসেট' : 'প্রতি মাসে রিসেট');

        if (planEl) planEl.textContent = planLabel;
        if (countEl) {
            if (info.limit === Infinity) {
                countEl.textContent = isBangla ? 'আনলিমিটেড' : 'Unlimited';
            } else {
                countEl.textContent = isBangla
                    ? `${info.remaining}/${info.limit} ${periodBn} বাকি`
                    : `${info.remaining}/${info.limit} left ${periodEn}`;
            }
        }
        if (hintEl) {
            hintEl.textContent = isBangla ? resetBn : resetEn;
        }
        if (barEl) {
            if (info.limit === Infinity) {
                barEl.style.width = '100%';
                barEl.dataset.state = 'unlimited';
            } else {
                const percent = info.limit ? Math.min(100, (info.used / info.limit) * 100) : 0;
                barEl.style.width = `${percent}%`;
                barEl.dataset.state = 'meter';
            }
        }

        const limitReached = info.limit !== Infinity && info.remaining <= 0;

        // Update old UI limit message
        if (limitMessage) {
            if (limitReached) {
                const titleText = isBangla
                    ? (cycle === 'day' ? 'আজকের এআই লিমিট শেষ হয়েছে' : (cycle === 'year' ? 'এই বছরের এআই লিমিট শেষ হয়েছে' : 'এই মাসের এআই লিমিট শেষ হয়েছে'))
                    : `Your AI limit is finished for ${periodEn}`;
                const bodyText = isBangla
                    ? `${resetBn}। আরও ব্যবহারের জন্য প্ল্যান আপগ্রেড করুন।`
                    : `${resetEn}. Upgrade your plan for more usage.`;
                if (limitTitle) limitTitle.textContent = titleText;
                if (limitBody) limitBody.textContent = bodyText;
                limitMessage.removeAttribute('hidden');
            } else {
                limitMessage.setAttribute('hidden', 'hidden');
            }
        }

        // Update new UI limit message
        if (limitMessageModern) {
            if (limitReached) {
                const modernTitle = limitMessageModern.querySelector('h3');
                const modernBody = limitMessageModern.querySelector('p');
                const titleText = isBangla
                    ? (cycle === 'day' ? 'আজকের এআই লিমিট শেষ হয়েছে' : (cycle === 'year' ? 'এই বছরের এআই লিমিট শেষ হয়েছে' : 'এই মাসের এআই লিমিট শেষ হয়েছে'))
                    : `Your AI limit is finished for ${periodEn}`;
                const bodyText = isBangla
                    ? `${resetBn}। আরও ব্যবহারের জন্য প্ল্যান দেখুন।`
                    : `${resetEn}. See plans for more usage.`;
                if (modernTitle) modernTitle.textContent = titleText;
                if (modernBody) modernBody.textContent = bodyText;
                limitMessageModern.removeAttribute('hidden');
            } else {
                limitMessageModern.setAttribute('hidden', 'hidden');
            }
        }

        updateNoApiBadge();

        if (inputEl) inputEl.disabled = limitReached;
        if (sendBtn) sendBtn.disabled = limitReached;
        if (voiceBtn) voiceBtn.disabled = limitReached;
    }

    function findCustomerFromText(text) {
        const lower = text.toLowerCase();
        let match = null;
        let bestLength = 0;
        state.customers.forEach(customer => {
            const name = (customer.name || '').toLowerCase().trim();
            if (!name) return;
            if (lower.includes(name) && name.length > bestLength) {
                match = customer;
                bestLength = name.length;
            }
        });
        return match;
    }

    function extractNumberFromText(text) {
        const normalized = normalizeBanglaDigits(text);
        const match = normalized.match(/(\d+(?:\.\d+)?)/);
        return match ? Number(match[1]) : null;
    }

    function extractAmountFromText(text) {
        const normalized = normalizeBanglaDigits(text);
        const match = normalized.match(/(\d+(?:\.\d+)?)(?=\s*(?:টাকা|taka|tk|৳))/i);
        if (match) return Number(match[1]);
        return extractNumberFromText(text);
    }

    function addDaysToToday(days) {
        const date = new Date();
        date.setDate(date.getDate() + days);
        return date.toISOString().slice(0, 10);
    }

    function extractDateFromText(text) {
        const normalized = normalizeText(text);
        // Relative dates (Bangla/Banglish friendly)
        if (normalized.includes('yesterday') || normalized.includes('গতকাল')) return addDaysToToday(-1);
        if (normalized.includes('today') || normalized.includes('আজ')) return todayString();
        // Must check "day after tomorrow" before "tomorrow" because it contains the word "tomorrow".
        if (normalized.includes('day after tomorrow') || normalized.includes('পরশু')) return addDaysToToday(2);
        if (normalized.includes('tomorrow') || normalized.includes('আগামীকাল') || (normalized.includes('কাল') && !normalized.includes('গতকাল'))) {
            return addDaysToToday(1);
        }

        const isoMatch = normalized.match(/\d{4}-\d{2}-\d{2}/);
        if (isoMatch) return isoMatch[0];

        const dmMatch = normalized.match(/(\d{1,2})[\/.-](\d{1,2})(?:[\/.-](\d{2,4}))?/);
        if (dmMatch) {
            const now = new Date();
            const day = Number(dmMatch[1]);
            const month = Number(dmMatch[2]);
            const yearRaw = dmMatch[3];
            const year = yearRaw ? Number(yearRaw.length === 2 ? `20${yearRaw}` : yearRaw) : now.getFullYear();
            if (day > 0 && month > 0 && month <= 12) {
                const date = new Date(year, month - 1, day);
                if (!Number.isNaN(date.getTime())) return date.toISOString().slice(0, 10);
            }
        }
        return '';
    }

    function extractQuotedText(text) {
        const match = text.match(/["'“”‘’](.+?)["'“”‘’]/);
        return match ? match[1].trim() : '';
    }

    function extractNoteFromText(text, allowQuoted) {
        const notePatterns = [
            /(?:note|memo|নোট|মন্তব্য|নোট লিখো|নোট লিখুন|লিখো|লিখুন)\s*[:\-]?\s*(.+)$/i
        ];
        for (const pattern of notePatterns) {
            const match = text.match(pattern);
            if (match && match[1]) return match[1].trim();
        }
        if (allowQuoted) {
            const quoted = extractQuotedText(text);
            if (quoted) return quoted;
        }
        return '';
    }

    function extractNameFromText(text) {
        const match = text.match(/(?:কাস্টমার\s*নাম|গ্রাহক\s*নাম|customer\s*name|customer|name|নাম)\s*([A-Za-z\u0980-\u09FF\s]+?)(?:\s+(?:টাকা|taka|বাকি|দেনা|debt|due)|[.,]|$)/i);
        if (match && match[1]) return match[1].trim();

        // Bangla possessive forms: "করিমের কাছে ..."
        const bnKache = text.match(/^\s*([\u0980-\u09FF]+?)(?:এর|র|ের)\s*(?:কাছে|কাছ)\b/);
        if (bnKache && bnKache[1]) return bnKache[1].trim();

        // Banglish: "Karim er kase ..."
        const banglishKase = text.match(/^\s*([A-Za-z][A-Za-z\s.'-]*?)\s+(?:er|ir|or)\s+(?:kase|kache|kachhe|kashe)\b/i);
        if (banglishKase && banglishKase[1]) return banglishKase[1].trim();

        // Also allow "... Karim kache ..." style
        const banglishKache = text.match(/\b([A-Za-z][A-Za-z.'-]*)\s+(?:kase|kache|kachhe|kashe)\b/i);
        if (banglishKache && banglishKache[1]) {
            const candidate = banglishKache[1].trim();
            if (!['er', 'ir', 'or'].includes(candidate.toLowerCase())) return candidate;
        }

        const normalized = normalizeBanglaDigits(text);
        const numberMatch = normalized.match(/(\d+(?:\.\d+)?)/);
        if (!numberMatch) return '';
        const prefix = text.slice(0, numberMatch.index).trim();
        if (!prefix) return '';
        return prefix
            .replace(/(টাকা|taka|বাকি|দেনা|debt|due|owed|amount)$/i, '')
            .trim();
    }

    function extractTimeFromText(text) {
        const normalized = normalizeBanglaDigits(text).toLowerCase();
        const hasHint = /(am|pm|a\.m\.|p\.m\.|সকাল|দুপুর|বিকাল|সন্ধ্যা|রাত|morning|afternoon|evening|night|টা|টায়|টায়)/.test(normalized);
        const timeMatch = normalized.match(/(\d{1,2})(?::(\d{2}))?/);
        if (!timeMatch || !hasHint) return null;

        let hour = Number(timeMatch[1]);
        let minute = Number(timeMatch[2] || '0');
        if (Number.isNaN(hour) || hour > 23) return null;
        if (Number.isNaN(minute) || minute > 59) minute = 0;

        const ampmMatch = normalized.match(/\b(am|pm|a\.m\.|p\.m\.)\b/);
        if (ampmMatch) {
            const isPm = ampmMatch[1].includes('p');
            if (isPm && hour < 12) hour += 12;
            if (!isPm && hour === 12) hour = 0;
        } else if (/রাত|সন্ধ্যা|evening|night|বিকাল/.test(normalized)) {
            if (hour < 12) hour += 12;
        } else if (/দুপুর|afternoon/.test(normalized)) {
            if (hour < 12) hour += 12;
        } else if (/সকাল|morning/.test(normalized)) {
            if (hour === 12) hour = 0;
        }

        return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
    }

    function parseDebtFromText(text, options = {}) {
        const fallbackCustomerId = options.customerId || '';
        let customer = findCustomerFromText(text);
        if (!customer && fallbackCustomerId) {
            customer = state.customers.find(c => c.id === fallbackCustomerId) || null;
        }

        let customerName = customer?.name || '';
        let customerId = customer?.id || fallbackCustomerId || '';

        if (!customerName) {
            const extracted = extractNameFromText(text);
            if (extracted) {
                const matched = state.customers.find(c => c.name.toLowerCase().includes(extracted.toLowerCase()));
                if (matched) {
                    customer = matched;
                    customerName = matched.name;
                    customerId = matched.id;
                } else {
                    customerName = extracted;
                }
            }
        }

        const amount = extractAmountFromText(text);
        const note = extractNoteFromText(text, true);
        const date = extractDateFromText(text) || todayString();

        const missing = [];
        if (!customerId && !customerName) missing.push('customer');
        if (!amount) missing.push('amount');

        return { customerId, customerName, amount, note, date, missing };
    }

    function parseTaskFromText(text) {
        const quotedTitle = extractQuotedText(text);
        let title = quotedTitle || extractTaskText(text);
        if (!title) {
            title = text
                .replace(/(?:টাস্ক|task|todo|কাজ)$/i, '')
                .replace(/(?:যোগ করো|অ্যাড করো|add|create|new)\s*$/i, '')
                .trim();
        }
        const date = extractDateFromText(text) || todayString();
        const time = extractTimeFromText(text);
        const note = extractNoteFromText(text, false);

        const missing = [];
        if (!title) missing.push('title');

        return { title, date, time, note, missing };
    }

    function ensureCustomerByName(name) {
        const trimmed = (name || '').trim();
        if (!trimmed) return null;
        const existing = state.customers.find(c => (c.name || '').toLowerCase() === trimmed.toLowerCase());
        if (existing) return existing;
        const customer = prepareCustomerRecord({
            id: generateId('cust'),
            name: trimmed,
            phone: '',
            repaymentDays: 7,
            note: ''
        });
        state.customers.push(customer);
        saveState();
        renderCustomers();
        renderDebtLedger();
        renderAIDebtCalendar();
        return customer;
    }

    function autoRecordDebtEntry(customer, amount, note, date) {
        if (!customer || !amount) return null;
        const debtRecord = {
            id: generateId('debt'),
            amount: Math.max(0, Number(amount) || 0),
            paidAmount: 0,
            date: date || todayString(),
            description: note || '',
            dueDate: computeDueDate(date || todayString(), Number(customer.repaymentDays) || 7),
            reminders: { dueToday: false, overdue: false }
        };
        customer.debts = customer.debts || [];
        customer.history = customer.history || [];
        customer.debts.push(debtRecord);
        customer.history.push({
            id: generateId('hist'),
            type: 'debt',
            amount: debtRecord.amount,
            date: debtRecord.date,
            description: debtRecord.description
        });
        customer.updatedAt = Date.now();
        saveState();
        renderCustomers();
        renderDebtLedger();
        renderAIDebtCalendar();
        return debtRecord;
    }

    function autoCreateTaskEntry(taskData) {
        const task = {
            id: generateId('task'),
            name: taskData.title || translate('notesTasks.title'),
            type: 'personal',
            priority: 'medium',
            dueDate: taskData.date || todayString(),
            dueTime: taskData.time || '',
            note: taskData.note || '',
            recurring: false,
            recurringType: 'daily',
            done: false,
            reminderSent: false,
            createdAt: Date.now()
        };
        state.tasks.push(task);
        saveState();
        renderTasks();
        renderNewTodoList(getCurrentTodoCategory());
        updateTodoStats();
        return task;
    }

    function parseBillItemsFromText(text) {
        const normalized = normalizeBanglaDigits(text);
        const parts = normalized.split(/[,|\n]/).map(p => p.trim()).filter(Boolean);
        const items = [];
        parts.forEach((part, idx) => {
            const amountMatch = part.match(/(\d+(?:\.\d+)?)/);
            if (!amountMatch) return;
            const amount = Number(amountMatch[1]) || 0;
            const name = part
                .replace(amountMatch[0], '')
                .replace(/(টাকা|taka|tk|৳)/gi, '')
                .trim() || `Item ${idx + 1}`;
            items.push({
                name,
                price: amount,
                quantity: 1,
                discount: 0,
                subtotal: amount
            });
        });
        return items;
    }

    function detectPaymentStatusFromText(text) {
        const normalized = normalizeText(text);
        if (/paid|পরিশোধ|দেওয়া|cleared|পেইড/.test(normalized)) return 'paid';
        if (/partial|আংশিক|installment/.test(normalized)) return 'partial';
        return 'pending';
    }

    function autoCreateBillFromItems(items, customer, paymentStatus = 'pending') {
        const safeItems = Array.isArray(items) ? items : [];
        const subtotal = safeItems.reduce((sum, item) => sum + (Number(item.subtotal) || Number(item.price) || 0), 0);
        const bill = {
            id: generateId('bill'),
            customerId: customer?.id || null,
            customerName: customer?.name || '',
            invoiceNumber: generateInvoiceNumber(),
            products: safeItems.map(item => Object.assign({ quantity: 1, discount: 0 }, item)),
            subtotal,
            totalDiscount: 0,
            discountAmount: 0,
            tax: 0,
            taxAmount: 0,
            total: subtotal,
            dueDate: null,
            paymentStatus: paymentStatus || 'pending',
            notes: '',
            date: todayString(),
            createdAt: Date.now(),
            updatedAt: Date.now()
        };

        state.bills = state.bills || [];
        state.bills.unshift(bill);
        saveState();
        renderBills();
        return bill;
    }

    function deleteCustomerByName(name) {
        const trimmed = (name || '').trim().toLowerCase();
        if (!trimmed) return null;
        const idx = state.customers.findIndex(c => (c.name || '').toLowerCase().includes(trimmed));
        if (idx === -1) return null;
        const [removed] = state.customers.splice(idx, 1);
        saveState();
        renderCustomers();
        renderDebtLedger();
        renderAIDebtCalendar();
        return removed;
    }

    function deleteTaskByText(text) {
        const normalized = normalizeText(text || '').trim();
        if (!normalized) return null;
        const task = state.tasks.find(t => normalizeText(t.name).includes(normalized));
        if (!task) return null;
        state.tasks = state.tasks.filter(t => t.id !== task.id);
        saveState();
        renderTasks();
        renderNewTodoList(getCurrentTodoCategory());
        updateTodoStats();
        return task;
    }

    function completeTaskByText(text) {
        const normalized = normalizeText(text || '').trim();
        if (!normalized) return null;
        const task = state.tasks.find(t => normalizeText(t.name).includes(normalized));
        if (!task) return null;
        task.done = true;
        task.updatedAt = Date.now();
        saveState();
        renderTasks();
        renderNewTodoList(getCurrentTodoCategory());
        renderSimpleTodoList();
        updateTodoStats();
        return task;
    }

    function findBillByInvoiceNumber(invoiceNumber) {
        if (!invoiceNumber) return null;
        const normalized = normalizeText(invoiceNumber);
        return (state.bills || []).find(b => normalizeText(b.invoiceNumber || '').includes(normalized)) || null;
    }

    function markLatestBillPaidForCustomer(customerName) {
        if (!customerName) return null;
        const normalized = customerName.toLowerCase();
        const matchingBills = (state.bills || []).filter(b => {
            if (!b) return false;
            const byName = (b.customerName || '').toLowerCase().includes(normalized);
            const byId = b.customerId
                ? state.customers.find(c => c.id === b.customerId)?.name?.toLowerCase().includes(normalized)
                : false;
            return byName || byId;
        });
        if (matchingBills.length === 0) return null;
        const unpaidBills = matchingBills.filter(b => b.paymentStatus !== 'paid');
        if (unpaidBills.length === 0) return { bill: null, status: 'already_paid' };
        unpaidBills.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
        const bill = unpaidBills[0];
        bill.paymentStatus = 'paid';
        bill.updatedAt = Date.now();
        saveState();
        renderBills();
        return { bill, status: 'paid' };
    }

    function summarizePaymentStatus(customer) {
        const outstanding = getCustomerOutstandingBalance(customer);
        const customerBills = (state.bills || []).filter(b =>
            b.customerId === customer.id || (b.customerName || '').toLowerCase() === (customer.name || '').toLowerCase()
        );
        const paidBills = customerBills.filter(b => b.paymentStatus === 'paid').length;
        if (state.language === 'bn') {
            return outstanding > 0
                ? `${customer.name} এর বাকি আছে ${formatCurrency(outstanding)}। পরিশোধিত বিল: ${paidBills}/${customerBills.length}.`
                : `${customer.name} এর কোনো বাকি নেই। পরিশোধিত বিল: ${paidBills}/${customerBills.length}.`;
        }
        return outstanding > 0
            ? `${customer.name} owes ${formatCurrency(outstanding)}. Paid bills: ${paidBills}/${customerBills.length}.`
            : `${customer.name} has no dues. Paid bills: ${paidBills}/${customerBills.length}.`;
    }

    function isCardThemeRequest(text) {
        const cardKeywords = ['card', 'কার্ড'];
        const themeKeywords = ['theme', 'থিম', 'style', 'স্টাইল', 'template', 'টেমপ্লেট', 'design', 'ডিজাইন'];
        const actionKeywords = ['make', 'create', 'generate', 'change', 'update', 'বানাও', 'তৈরি', 'পরিবর্তন', 'আপডেট'];
        const hasCard = cardKeywords.some(keyword => text.includes(keyword));
        if (!hasCard) return false;
        return themeKeywords.some(keyword => text.includes(keyword)) || actionKeywords.some(keyword => text.includes(keyword));
    }

    function extractThemeIntent(text) {
        // Theme switching commands (Bangla/Banglish friendly).
        // Examples:
        // - "theme poriborton koro"
        // - "onno theme deo"
        // - "dark theme", "light mode", "cozy theme"
        const themeKeywords = ['theme', 'themes', 'thim', 'থিম', 'mode', 'মোড', 'ui', 'appearance'];
        const hasThemeWord = themeKeywords.some(keyword => text.includes(keyword));
        if (!hasThemeWord) return null;

        const changeKeywords = [
            'change', 'chnage', 'switch', 'set', 'apply', 'update',
            'koro', 'kor', 'deo', 'dao',
            'poriborton', 'bodol', 'bodle', 'badlao', 'bodlao',
            'পরিবর্তন', 'বদল', 'করো', 'দাও', 'দে',
            'onno', 'another', 'next', 'different'
        ];
        const hasChangeWord = changeKeywords.some(keyword => text.includes(keyword));

        const hasCozy = ['cozy', 'cosy', 'কোজি', 'আরামদায়ক', 'aramdayok', 'aramdaiok', 'warm'].some(token => text.includes(normalizeText(token)));
        const hasDark = ['dark', 'ডার্ক', 'কালো', 'রাত', 'kalo', 'rat', 'night', 'nite', 'black'].some(token => text.includes(normalizeText(token)));
        const hasLight = ['light', 'লাইট', 'সাদা', 'উজ্জ্বল', 'sada', 'shada', 'white', 'clean', 'minimal', 'simple'].some(token => text.includes(normalizeText(token)));

        if (hasCozy && hasDark) return 'night-shop';
        if (hasCozy) return 'cozy-ledger';
        if (hasDark) return 'night-shop';
        if (hasLight) return 'clean-business';

        const themes = {
            'studio': 'studio-pro',
            'studio pro': 'studio-pro',
            'premium': 'studio-pro',
            'স্টুডিও': 'studio-pro',
            'classic': 'classic-paper',
            'ক্লাসিক': 'classic-paper',
            'paper': 'classic-paper',
            'ledger': 'classic-paper',
            'traditional': 'classic-paper',
            'street': 'street-ledger',
            'স্ট্রিট': 'street-ledger',
            'bold': 'street-ledger',
            'zen': 'zen-finance',
            'জেন': 'zen-finance',
            'blue': 'zen-finance',
            'nil': 'zen-finance',
            'নীল': 'zen-finance',
            'ocean': 'zen-finance'
        };

        for (const [key, value] of Object.entries(themes)) {
            if (text.includes(normalizeText(key))) {
                return value;
            }
        }

        // If the user asked to change theme but didn't specify which theme, cycle to the next one.
        if (hasChangeWord) return '__cycle__';
        return null;
    }

    function getNextThemeInCycle(currentTheme) {
        const cycle = ['studio-pro', 'cozy-ledger', 'clean-business', 'night-shop', 'zen-finance', 'street-ledger', 'classic-paper'];
        const idx = cycle.indexOf(currentTheme);
        if (idx === -1) return cycle[0];
        return cycle[(idx + 1) % cycle.length];
    }

    function getThemeFriendlyName(theme, isBangla) {
        const names = {
            'studio-pro': { en: 'Studio', bn: 'স্টুডিও' },
            'cozy-ledger': { en: 'Cozy', bn: 'কোজি' },
            'clean-business': { en: 'Clean', bn: 'ক্লিন' },
            'night-shop': { en: 'Night', bn: 'ডার্ক' },
            'zen-finance': { en: 'Zen', bn: 'জেন' },
            'street-ledger': { en: 'Street', bn: 'স্ট্রিট' },
            'classic-paper': { en: 'Classic', bn: 'ক্লাসিক' },
            'light': { en: 'Light', bn: 'লাইট' },
            'dark': { en: 'Dark', bn: 'ডার্ক' },
            'ocean': { en: 'Ocean', bn: 'ওশান' },
            'rose': { en: 'Rose', bn: 'রোজ' }
        };
        const entry = names[theme];
        if (!entry) return theme;
        return isBangla ? entry.bn : entry.en;
    }

    const DEEPSEEK_ACTION_KEYWORDS = [
        // English action keywords
        'add', 'create', 'new', 'delete', 'remove', 'change', 'switch', 'update',
        'theme', 'task', 'note', 'debt', 'bill', 'invoice', 'customer', 'settings',
        'lock', 'open', 'show', 'panel', 'subscription', 'cancel', 'paid', 'payment',
        'complete', 'finish', 'done', 'mark', 'record', 'toggle', 'go', 'navigate',
        'list', 'help', 'premium', 'upgrade', 'downgrade',
        // Bangla action keywords
        'যোগ', 'নতুন', 'মুছুন', 'মুছে', 'পরিবর্তন', 'থিম', 'টাস্ক', 'কাজ', 'নোট',
        'বাকি', 'বিল', 'রসিদ', 'কাস্টমার', 'সেটিংস', 'পরিশোধ', 'বাতিল', 'সম্পন্ন',
        'খোলো', 'দেখাও', 'প্রিমিয়াম', 'আপগ্রেড'
    ];

    function shouldAttemptDeepSeekFirst(normalizedText) {
        if (!hasDeepSeekKey()) return false;
        return DEEPSEEK_ACTION_KEYWORDS.some(keyword => normalizedText.includes(keyword));
    }

    function extractJsonFromText(text) {
        if (!text) return null;
        const trimmed = String(text).trim();
        const fenced = trimmed.match(/```json([\s\S]*?)```/i) || trimmed.match(/```([\s\S]*?)```/i);
        const candidates = [];
        if (fenced && fenced[1]) candidates.push(fenced[1].trim());
        candidates.push(trimmed);

        for (const candidate of candidates) {
            if (!candidate) continue;
            if (candidate.startsWith('{') || candidate.startsWith('[')) {
                try {
                    return JSON.parse(candidate);
                } catch (err) {
                    // continue
                }
            }
        }

        const firstBrace = trimmed.indexOf('{');
        const lastBrace = trimmed.lastIndexOf('}');
        if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
            const slice = trimmed.slice(firstBrace, lastBrace + 1);
            try {
                return JSON.parse(slice);
            } catch (err) {
                return null;
            }
        }
        return null;
    }

    function resolveThemeValue(value) {
        const normalized = normalizeText(value || '');
        const directThemes = [
            'studio-pro',
            'cozy-ledger',
            'clean-business',
            'night-shop',
            'zen-finance',
            'street-ledger',
            'classic-paper',
            'midnight-purple',
            'sunset-orange'
        ];
        if (directThemes.includes(normalized)) return normalized;
        const themeMap = {
            'studio': 'studio-pro',
            'premium': 'studio-pro',
            'cozy': 'cozy-ledger',
            'cosy': 'cozy-ledger',
            'clean': 'clean-business',
            'night': 'night-shop',
            'dark': 'night-shop',
            'zen': 'zen-finance',
            'street': 'street-ledger',
            'classic': 'classic-paper',
            'paper': 'classic-paper',
            'midnight': 'midnight-purple',
            'sunset': 'sunset-orange'
        };
        return themeMap[normalized] || '';
    }

    function executeDeepSeekAction(action, isBangla) {
        if (!action || typeof action !== 'object') return null;
        const actionName = normalizeText(action.action || action.type || '').replace(/\s+/g, '_');
        const data = action.data || action.payload || {};

        if (actionName === 'add_task') {
            const title = (data.title || data.task || '').toString().trim();
            const date = (data.date || todayString()).toString().trim();
            const time = (data.time || '').toString().trim();
            const note = (data.note || '').toString().trim();
            if (!title) {
                state.ai.pendingIntent = { type: 'add_task', data: { title: '', date, time, note } };
                return isBangla ? 'কোন কাজটি যোগ করবো?' : 'Which task should I add?';
            }
            autoCreateTaskEntry({ title, date, time, note });
            const dateLabel = date ? formatDisplayDate(date) : '';
            return isBangla
                ? `টাস্ক "${title}" যোগ করা হয়েছে${dateLabel ? ` — ${dateLabel}` : ''}${time ? ` ${time}` : ''}.`
                : `Added the task "${title}"${dateLabel ? ` — ${dateLabel}` : ''}${time ? ` ${time}` : ''}.`;
        }

        if (actionName === 'add_debt') {
            const customerName = (data.customerName || data.customer || data.name || '').toString().trim();
            const amount = Number(data.amount || data.value || 0);
            const note = (data.note || '').toString().trim();
            const date = (data.date || todayString()).toString().trim();
            if (!customerName) {
                state.ai.pendingIntent = { type: 'add_debt', data: { customerName: '', amount, note, date } };
                return isBangla ? 'কোন কাস্টমারের জন্য বাকি যোগ করবো?' : 'Which customer is this debt for?';
            }
            if (!amount) {
                state.ai.pendingIntent = { type: 'add_debt', data: { customerName, amount: 0, note, date } };
                return isBangla ? 'টাকার পরিমাণ কত?' : 'What amount should I record?';
            }
            const customer = ensureCustomerByName(customerName);
            const debt = autoRecordDebtEntry(customer, amount, note, date);
            const dateLabel = debt?.dueDate ? formatDisplayDate(debt.dueDate) : '';
            const noteLabel = note ? ` — ${note}` : '';
            return isBangla
                ? `${customer.name} এর জন্য ${formatCurrency(amount)} বাকি নিলাম${dateLabel ? ` — ${dateLabel}` : ''}${noteLabel}।`
                : `Recorded ${formatCurrency(amount)} debt for ${customer.name}${dateLabel ? ` — ${dateLabel}` : ''}${noteLabel}.`;
        }

        if (actionName === 'add_note') {
            const title = (data.title || data.subject || '').toString().trim();
            const body = (data.body || data.text || data.note || '').toString().trim();
            if (!title && !body) {
                return isBangla ? 'কী নোট লিখবো?' : 'What note should I write?';
            }
            const safeTitle = title || (body.length > 32 ? `${body.slice(0, 32)}...` : body);
            state.notes.unshift({
                id: generateId('note'),
                title: safeTitle,
                body,
                color: (data.color || 'yellow').toString().trim() || 'yellow',
                pinned: !!data.pinned,
                createdAt: Date.now(),
                updatedAt: Date.now()
            });
            saveState();
            renderNotes();
            playFeedback();
            return isBangla
                ? `নোট "${safeTitle}" যোগ করা হয়েছে।`
                : `Added the note "${safeTitle}".`;
        }

        if (actionName === 'delete_task') {
            const target = (data.title || data.task || '').toString().trim();
            if (!target) {
                return isBangla ? 'কোন টাস্কটি মুছবো?' : 'Which task should I remove?';
            }
            const removed = deleteTaskByText(target);
            return removed
                ? (isBangla ? `"${removed.name}" টাস্ক মুছে দিয়েছি।` : `Removed the task "${removed.name}".`)
                : (isBangla ? 'এই নামে কোনো টাস্ক পাইনি।' : 'I could not find that task.');
        }

        if (actionName === 'delete_customer') {
            const target = (data.name || data.customer || '').toString().trim();
            if (!target) {
                return isBangla ? 'কোন কাস্টমারকে মুছবো?' : 'Which customer should I remove?';
            }
            const removed = deleteCustomerByName(target);
            return removed
                ? (isBangla ? `${removed.name} কে তালিকা থেকে মুছে ফেলেছি।` : `Removed ${removed.name} from your customers.`)
                : (isBangla ? 'এই নামে কোনো কাস্টমার পাইনি।' : 'I could not find that customer.');
        }

        if (actionName === 'change_theme') {
            const requested = resolveThemeValue(data.theme || data.value || data.name || '');
            if (!requested) {
                return isBangla ? 'কোন থিমে যেতে চান?' : 'Which theme should I switch to?';
            }
            applyTheme(requested);
            saveState();
            playFeedbackStrong();
            const themeLabel = getThemeFriendlyName(requested, isBangla);
            return isBangla
                ? `ঠিক আছে, থিম ${themeLabel} করে দিলাম।`
                : `Done! Theme switched to ${themeLabel}.`;
        }

        if (actionName === 'create_bill') {
            const items = Array.isArray(data.items) ? data.items : [];
            const customerName = (data.customerName || data.customer || data.name || '').toString().trim();
            const paymentStatus = data.paymentStatus || 'pending';
            if (!items.length) {
                return isBangla ? 'রসিদের আইটেমগুলো দিন।' : 'Please share the bill items.';
            }
            if (!customerName) {
                state.ai.pendingIntent = { type: 'bill', data: { items, customerName: '', paymentStatus } };
                return isBangla ? 'রসিদ কার নামে হবে?' : 'Which customer should I use for this bill?';
            }
            const customer = ensureCustomerByName(customerName);
            const bill = autoCreateBillFromItems(items, customer, paymentStatus);
            const totalText = formatCurrency(bill.total);
            return isBangla
                ? `${customer.name} এর জন্য ${items.length} আইটেমের রসিদ তৈরি: মোট ${totalText}।`
                : `Created a ${items.length}-item receipt for ${customer.name}. Total ${totalText}.`;
        }

        if (actionName === 'mark_bill_paid') {
            const invoiceNumber = (data.invoiceNumber || data.invoice || data.number || '').toString().trim();
            const customerName = (data.customerName || data.customer || data.name || '').toString().trim();
            let result = null;
            if (invoiceNumber) {
                const bill = findBillByInvoiceNumber(invoiceNumber);
                if (!bill) {
                    return isBangla ? 'এই ইনভয়েস নম্বর পাইনি।' : 'I could not find that invoice number.';
                }
                if (bill.paymentStatus === 'paid') {
                    return isBangla ? 'বিলটি আগেই পরিশোধ করা আছে।' : 'That bill is already marked as paid.';
                }
                bill.paymentStatus = 'paid';
                bill.updatedAt = Date.now();
                saveState();
                renderBills();
                result = bill;
            } else if (customerName) {
                const outcome = markLatestBillPaidForCustomer(customerName);
                if (!outcome) {
                    return isBangla ? 'এই নামে কোনো বিল পেলাম না।' : 'I could not find a bill for that customer.';
                }
                if (outcome.status === 'already_paid') {
                    return isBangla ? 'এই কাস্টমারের সব বিল আগেই পরিশোধ করা আছে।' : 'All bills for this customer are already paid.';
                }
                result = outcome.bill;
            } else {
                return isBangla ? 'কোন বিলটি পরিশোধ হয়েছে? ইনভয়েস নম্বর বা নাম বলুন।' : 'Which bill was paid? Share an invoice number or customer name.';
            }
            if (!result) return null;
            return isBangla
                ? `${result.customerName || 'বিল'} পরিশোধ হয়ে গেছে বলে চিহ্নিত করেছি।`
                : `Marked the bill for ${result.customerName || 'this customer'} as paid.`;
        }

        if (actionName === 'open_panel') {
            const panelRaw = normalizeText(data.panel || data.view || data.target || '');
            const panelMap = {
                home: 'premium',
                premium: 'premium',
                pricing: 'premium',
                customers: 'customers',
                debts: 'customers',
                bills: 'bills',
                ai: 'ai',
                agent: 'ai',
                notes: 'notes',
                tasks: 'notes',
                settings: 'settings'
            };
            const panel = panelMap[panelRaw];
            if (!panel) {
                return isBangla ? 'কোন প্যানেলে যেতে চান?' : 'Which panel should I open?';
            }
            setActivePanel(panel);
            if (panel === 'notes' && data.tab) {
                const tab = normalizeText(data.tab);
                if (tab.includes('task')) switchNotesTab('tasks');
                else switchNotesTab('notes');
            }
            return isBangla
                ? 'ঠিক আছে, খুলে দিলাম।'
                : 'Done. Opening it now.';
        }

        // Delete note action
        if (actionName === 'delete_note') {
            const target = (data.title || data.note || data.name || '').toString().trim();
            if (!target) {
                return isBangla ? 'কোন নোটটি মুছবো?' : 'Which note should I delete?';
            }
            const lowerTarget = target.toLowerCase();
            const noteIdx = state.notes.findIndex(n =>
                (n.title || '').toLowerCase().includes(lowerTarget) ||
                (n.body || '').toLowerCase().includes(lowerTarget)
            );
            if (noteIdx === -1) {
                return isBangla ? 'এই নামে কোনো নোট পাইনি।' : 'I could not find that note.';
            }
            const removedNote = state.notes.splice(noteIdx, 1)[0];
            saveState();
            renderNotes();
            playFeedback();
            return isBangla
                ? `"${removedNote.title || 'নোট'}" মুছে ফেলেছি।`
                : `Deleted the note "${removedNote.title || 'note'}".`;
        }

        // Complete/mark task as done action
        if (actionName === 'complete_task' || actionName === 'mark_done' || actionName === 'finish_task') {
            const target = (data.title || data.task || data.name || '').toString().trim();
            if (!target) {
                return isBangla ? 'কোন টাস্কটি সম্পন্ন করবো?' : 'Which task should I complete?';
            }
            const lowerTarget = target.toLowerCase();
            const task = state.tasks.find(t =>
                (t.name || '').toLowerCase().includes(lowerTarget) ||
                (t.title || '').toLowerCase().includes(lowerTarget)
            );
            if (!task) {
                return isBangla ? 'এই নামে কোনো টাস্ক পাইনি।' : 'I could not find that task.';
            }
            task.completed = true;
            task.completedAt = Date.now();
            saveState();
            renderTasks();
            playFeedback();
            return isBangla
                ? `"${task.name}" সম্পন্ন হয়েছে বলে চিহ্নিত করেছি।`
                : `Marked "${task.name}" as completed.`;
        }

        // Record payment action - reduce customer debt
        if (actionName === 'record_payment') {
            const customerName = (data.customerName || data.customer || data.name || '').toString().trim();
            const amount = Number(data.amount || data.value || 0);
            if (!customerName) {
                return isBangla ? 'কোন কাস্টমার টাকা দিয়েছে?' : 'Which customer made the payment?';
            }
            if (!amount) {
                state.ai.pendingIntent = { type: 'record_payment', data: { customerName, amount: 0 } };
                return isBangla ? 'কত টাকা পরিশোধ করেছে?' : 'How much did they pay?';
            }
            const lowerName = customerName.toLowerCase();
            const customer = state.customers.find(c =>
                (c.name || '').toLowerCase().includes(lowerName)
            );
            if (!customer) {
                return isBangla ? 'এই নামে কোনো কাস্টমার পাইনি।' : 'I could not find that customer.';
            }
            // Add a payment record (negative debt entry)
            const paymentEntry = {
                id: generateId('debt'),
                amount: -Math.abs(amount),
                description: isBangla ? 'পেমেন্ট গ্রহণ' : 'Payment received',
                date: todayString(),
                createdAt: Date.now()
            };
            customer.debts = customer.debts || [];
            customer.debts.push(paymentEntry);
            saveState();
            renderCustomers();
            playFeedback();
            return isBangla
                ? `${customer.name} থেকে ${formatCurrency(amount)} পেমেন্ট রেকর্ড করেছি।`
                : `Recorded ${formatCurrency(amount)} payment from ${customer.name}.`;
        }

        // Cancel subscription action
        if (actionName === 'cancel_subscription') {
            const currentPlan = getActivePlan();
            if (currentPlan === 'free') {
                return isBangla
                    ? 'আপনি এখন ফ্রি প্ল্যানে আছেন। বাতিল করার কিছু নেই।'
                    : 'You are already on the Free plan. Nothing to cancel.';
            }
            cancelSubscription(false);
            return isBangla
                ? 'সাবস্ক্রিপশন বাতিল হয়েছে। আপনি এখন ফ্রি প্ল্যানে।'
                : 'Subscription cancelled. You are now on the Free plan.';
        }

        return null;
    }

    function tryHandleDeepSeekActions(responseText, isBangla) {
        const payload = extractJsonFromText(responseText);
        if (!payload) return null;
        const actions = Array.isArray(payload)
            ? payload
            : Array.isArray(payload.actions)
                ? payload.actions
                : [payload];
        const replies = [];
        actions.forEach(action => {
            const result = executeDeepSeekAction(action, isBangla);
            if (result) replies.push(result);
        });
        if (replies.length === 0) return null;
        const responseOverride = typeof payload.reply === 'string' && payload.reply.trim() ? payload.reply.trim() : '';
        return responseOverride || replies.join('\n');
    }

    function extractTaskText(text) {
        const patterns = [
            /(?:add|create|new)\s+(?:task|todo)\s*(.+)/i,
            /(?:task|todo)\s*(.+)/i,
            /(?:নতুন|যোগ|অ্যাড)\s*কাজ\s*(.+)/i,
            /(?:টাস্ক|কাজ)\s*(.+)/i
        ];
        for (const pattern of patterns) {
            const match = text.match(pattern);
            if (match && match[1]) return match[1].trim();
        }
        return '';
    }

    function extractNoteText(text) {
        const patterns = [
            /(?:add|create|new)\s+note\s*(.+)/i,
            /(?:note|memo)\s*(.+)/i,
            /(?:নতুন|যোগ|অ্যাড)\s*নোট\s*(.+)/i,
            /(?:নোট)\s*(.+)/i
        ];
        for (const pattern of patterns) {
            const match = text.match(pattern);
            if (match && match[1]) return match[1].trim();
        }
        return '';
    }

    function resetFieldMissing(form) {
        if (!form) return;
        form.querySelectorAll('.field-missing').forEach(el => el.classList.remove('field-missing'));
    }

    function markFieldMissing(form, fieldName) {
        if (!form) return;
        const field = form.querySelector(`[name="${fieldName}"]`);
        const label = field?.closest('label');
        if (label) label.classList.add('field-missing');
    }

    function hideDebtVoicePreview() {
        const preview = document.getElementById('debt-voice-preview');
        if (preview) preview.hidden = true;
        resetFieldMissing(forms.debt);
    }

    function hideTaskVoicePreview() {
        const preview = document.getElementById('task-voice-preview');
        if (preview) preview.hidden = true;
        resetFieldMissing(forms.task);
    }

    function showDebtVoicePreview(payload) {
        const preview = document.getElementById('debt-voice-preview');
        if (!preview) return;

        const isBangla = state.language === 'bn';
        const customerName = payload.customerId
            ? state.customers.find(c => c.id === payload.customerId)?.name
            : payload.customerName;
        const amountText = payload.amount ? formatCurrency(payload.amount) : '—';
        const dateText = payload.date ? formatDisplayDate(payload.date) : '—';
        const noteText = payload.note ? payload.note : '—';

        const customerEl = document.getElementById('debt-preview-customer');
        const amountEl = document.getElementById('debt-preview-amount');
        const typeEl = document.getElementById('debt-preview-type');
        const dateEl = document.getElementById('debt-preview-date');
        const noteEl = document.getElementById('debt-preview-note');
        const questionEl = document.getElementById('debt-voice-question');
        const confirmBtn = document.getElementById('debt-voice-confirm');

        if (customerEl) customerEl.textContent = customerName || '—';
        if (amountEl) amountEl.textContent = amountText;
        if (typeEl) typeEl.textContent = isBangla ? 'বাকি' : 'Baki';
        if (dateEl) dateEl.textContent = dateText;
        if (noteEl) noteEl.textContent = noteText;

        resetFieldMissing(forms.debt);
        const missing = payload.missing || [];
        let question = translate('voice.preview.confirmQuestion');
        if (missing.includes('customer')) {
            question = isBangla ? 'কোন কাস্টমারের জন্য বাকি যোগ করবো?' : 'Which customer is this debt for?';
            markFieldMissing(forms.debt, 'customerId');
        } else if (missing.includes('amount')) {
            question = isBangla ? 'টাকার পরিমাণ কত?' : 'What amount should I record?';
            markFieldMissing(forms.debt, 'amount');
        }

        if (questionEl) questionEl.textContent = question;
        if (confirmBtn) confirmBtn.disabled = missing.length > 0;
        preview.hidden = false;
    }

    function showTaskVoicePreview(payload) {
        const preview = document.getElementById('task-voice-preview');
        if (!preview) return;

        const isBangla = state.language === 'bn';
        const titleEl = document.getElementById('task-preview-title');
        const dateEl = document.getElementById('task-preview-date');
        const timeEl = document.getElementById('task-preview-time');
        const noteEl = document.getElementById('task-preview-note');
        const questionEl = document.getElementById('task-voice-question');
        const confirmBtn = document.getElementById('task-voice-confirm');

        if (titleEl) titleEl.textContent = payload.title || '—';
        if (dateEl) dateEl.textContent = payload.date ? formatDisplayDate(payload.date) : '—';
        if (timeEl) timeEl.textContent = payload.time || '—';
        if (noteEl) noteEl.textContent = payload.note || '—';

        resetFieldMissing(forms.task);
        const missing = payload.missing || [];
        let question = translate('voice.preview.confirmQuestion');
        if (missing.includes('title')) {
            question = isBangla ? 'কোন কাজটি যোগ করবো?' : 'Which task should I add?';
            markFieldMissing(forms.task, 'name');
        }

        if (questionEl) questionEl.textContent = question;
        if (confirmBtn) confirmBtn.disabled = missing.length > 0;
        preview.hidden = false;
    }

    function openDebtModalPrefill(customer, amount, description, date) {
        if (!forms.debt || !modals.debt) return;
        forms.debt.reset();
        populateDebtCustomerSelect();
        if (customer?.id && forms.debt.elements.customerId) {
            forms.debt.elements.customerId.value = customer.id;
        }
        if (amount && forms.debt.elements.amount) {
            forms.debt.elements.amount.value = amount;
        }
        if (description && forms.debt.elements.description) {
            forms.debt.elements.description.value = description;
        }
        if (forms.debt.elements.date) {
            forms.debt.elements.date.value = date || todayString();
        }
        hideDebtVoicePreview();
        modals.debt.showModal();
        playFeedback();
    }

    function openTaskModalPrefill(taskName, dueDate, dueTime, note) {
        if (!forms.task || !modals.task) return;
        forms.task.reset();
        if (forms.task.elements.name) forms.task.elements.name.value = taskName || '';
        if (forms.task.elements.type) forms.task.elements.type.value = 'personal';
        if (forms.task.elements.priority) forms.task.elements.priority.value = 'medium';
        if (forms.task.elements.dueDate) forms.task.elements.dueDate.value = dueDate || todayString();
        if (forms.task.elements.dueTime) forms.task.elements.dueTime.value = dueTime || '';
        if (forms.task.elements.note) forms.task.elements.note.value = note || '';
        if (forms.task.elements.taskId) forms.task.elements.taskId.value = '';
        const recurringOptions = document.getElementById('recurring-options');
        if (forms.task.elements.recurring) forms.task.elements.recurring.checked = false;
        if (recurringOptions) recurringOptions.style.display = 'none';
        hideTaskVoicePreview();
        modals.task.showModal();
        playFeedback();
    }

    function openNoteModalPrefill(noteTitle, noteBody) {
        if (!forms.note || !modals.note) return;
        forms.note.reset();
        forms.note.querySelector('[name="title"]').value = noteTitle;
        forms.note.querySelector('[name="body"]').value = noteBody || '';
        forms.note.querySelector('[name="noteId"]').value = '';
        modals.note.showModal();
        playFeedback();
    }

    function resolvePendingIntent(userMessage) {
        const pending = state.ai.pendingIntent;
        if (!pending) return null;

        const isBangla = state.language === 'bn';
        if (pending.type === 'add_debt') {
            const parsed = parseDebtFromText(userMessage, { customerId: pending.data.customerId });
            const merged = {
                customerId: parsed.customerId || pending.data.customerId,
                customerName: parsed.customerName || pending.data.customerName,
                amount: parsed.amount || pending.data.amount,
                note: parsed.note || pending.data.note,
                date: parsed.date || pending.data.date
            };

            const missing = [];
            if (!merged.customerId && !merged.customerName) missing.push('customer');
            if (!merged.amount) missing.push('amount');

            if (missing.length > 0) {
                state.ai.pendingIntent = { type: 'add_debt', data: merged };
                return missing.includes('customer')
                    ? (isBangla ? 'কোন কাস্টমারের জন্য বাকি যোগ করবো?' : 'Which customer is this debt for?')
                    : (isBangla ? 'টাকার পরিমাণ কত?' : 'What amount should I record?');
            }

            const customer = merged.customerId
                ? state.customers.find(c => c.id === merged.customerId)
                : ensureCustomerByName(merged.customerName);
            if (!customer) {
                state.ai.pendingIntent = null;
                return isBangla ? 'ক্রেতার নামটা আবার বলুন।' : 'Please repeat the customer name.';
            }

            state.ai.pendingIntent = null;
            const debt = autoRecordDebtEntry(customer, merged.amount, merged.note, merged.date);
            const dateLabel = debt?.dueDate ? formatDisplayDate(debt.dueDate) : '';
            return isBangla
                ? `${customer.name} এর জন্য ${formatCurrency(merged.amount)} বাকি নোট করলাম${dateLabel ? ` (শেষ তারিখ: ${dateLabel})` : ''}।`
                : `Added a debt for ${customer.name}: ${formatCurrency(merged.amount)}${dateLabel ? ` (due: ${dateLabel})` : ''}.`;
        }

        if (pending.type === 'add_task') {
            const parsed = parseTaskFromText(userMessage);
            const merged = {
                title: parsed.title || pending.data.title,
                date: parsed.date || pending.data.date,
                time: parsed.time || pending.data.time,
                note: parsed.note || pending.data.note
            };

            const missing = [];
            if (!merged.title) missing.push('title');

            if (missing.length > 0) {
                state.ai.pendingIntent = { type: 'add_task', data: merged };
                return isBangla ? 'কোন কাজটি যোগ করবো?' : 'Which task should I add?';
            }

            state.ai.pendingIntent = null;
            autoCreateTaskEntry({
                title: merged.title,
                date: merged.date,
                time: merged.time,
                note: merged.note
            });
            const dateLabel = merged.date ? formatDisplayDate(merged.date) : '';
            const timeLabel = merged.time ? ` ${merged.time}` : '';
            return isBangla
                ? `টাস্ক "${merged.title}" সেভ করেছি${dateLabel ? ` — ${dateLabel}` : ''}${timeLabel ? ` ${timeLabel}` : ''}।`
                : `Saved the task "${merged.title}"${dateLabel ? ` — ${dateLabel}` : ''}${timeLabel ? ` ${timeLabel}` : ''}.`;
        }

        if (pending.type === 'bill') {
            const items = pending.data.items || [];
            const providedName = extractNameFromText(userMessage) || extractCustomerName(userMessage) || pending.data.customerName || '';
            const customer = ensureCustomerByName(providedName);
            if (!customer) {
                state.ai.pendingIntent = { type: 'bill', data: pending.data };
                return isBangla ? 'রসিদের জন্য ক্রেতার নামটা বলুন।' : 'Please share the customer name for this receipt.';
            }
            const status = detectPaymentStatusFromText(userMessage) || pending.data.paymentStatus || 'pending';
            const bill = autoCreateBillFromItems(items, customer, status);
            state.ai.pendingIntent = null;
            const totalText = formatCurrency(bill.total);
            return isBangla
                ? `${customer.name} এর নামে রসিদ তৈরি করেছি (${items.length} আইটেম, মোট ${totalText}).`
                : `Created a receipt for ${customer.name} with ${items.length} item(s), total ${totalText}.`;
        }

        // Handle record_payment pending intent
        if (pending.type === 'record_payment') {
            const amountMatch = userMessage.match(/(\d+)/);
            const amount = amountMatch ? Number(amountMatch[1]) : pending.data.amount;
            const customerName = pending.data.customerName;

            if (!amount) {
                return isBangla ? 'কত টাকা পরিশোধ করেছে?' : 'How much did they pay?';
            }

            const lowerName = customerName.toLowerCase();
            const customer = state.customers.find(c =>
                (c.name || '').toLowerCase().includes(lowerName)
            );
            if (!customer) {
                state.ai.pendingIntent = null;
                return isBangla ? 'এই নামে কোনো কাস্টমার পাইনি।' : 'I could not find that customer.';
            }

            // Add a payment record (negative debt entry)
            const paymentEntry = {
                id: generateId('debt'),
                amount: -Math.abs(amount),
                description: isBangla ? 'পেমেন্ট গ্রহণ' : 'Payment received',
                date: todayString(),
                createdAt: Date.now()
            };
            customer.debts = customer.debts || [];
            customer.debts.push(paymentEntry);
            saveState();
            renderCustomers();
            playFeedback();
            state.ai.pendingIntent = null;
            return isBangla
                ? `${customer.name} থেকে ${formatCurrency(amount)} পেমেন্ট রেকর্ড করেছি।`
                : `Recorded ${formatCurrency(amount)} payment from ${customer.name}.`;
        }

        return null;
    }

    async function handleAIMessage() {
        const input = document.getElementById('ai-input');
        const messagesContainer = document.getElementById('ai-messages');
        const suggestionsContainer = document.getElementById('ai-shortcuts');
        if (!input) return;

        const userMessage = input.value.trim();
        if (!userMessage) return;
        if (input.disabled) {
            updateAIUsageUI();
            return;
        }

        // Hide suggestions and show messages when conversation starts
        if (suggestionsContainer && suggestionsContainer.hidden === false) {
            suggestionsContainer.hidden = true;
        }
        if (messagesContainer) {
            messagesContainer.hidden = false;
        }

        // Add user message (support both old and new UI)
        const userMsgEl = document.createElement('div');
        if (messagesContainer.classList.contains('ai-chat-messages-modern')) {
            // New UI
            userMsgEl.className = 'ai-message-modern user';
            userMsgEl.innerHTML = `
                <div class="ai-message-avatar-modern">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
                        <circle cx="12" cy="7" r="4"></circle>
                    </svg>
                </div>
                <div class="ai-message-content-modern"><p>${escapeHtml(userMessage)}</p></div>
            `;
        } else {
            // Old UI
            userMsgEl.className = 'ai-message ai-message-user';
            userMsgEl.innerHTML = `
                <div class="ai-avatar">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
                        <circle cx="12" cy="7" r="4"></circle>
                    </svg>
                </div>
                <div class="ai-content"><p>${escapeHtml(userMessage)}</p></div>
            `;
        }
        if (messagesContainer) {
            messagesContainer.appendChild(userMsgEl);
            messagesContainer.scrollTop = messagesContainer.scrollHeight;
        }
        input.value = '';
        playFeedback();
        animateAIBuddy('thinking');
        const sendBtn = document.getElementById('ai-send-btn');
        if (sendBtn) sendBtn.disabled = true;

        // Generate AI response
        const aiResponse = await generateAIResponse(userMessage);

        // Add AI response (support both old and new UI)
        const aiMsgEl = document.createElement('div');
        if (messagesContainer && messagesContainer.classList.contains('ai-chat-messages-modern')) {
            // New UI
            aiMsgEl.className = 'ai-message-modern assistant';
            aiMsgEl.innerHTML = `
                <div class="ai-message-avatar-modern">🤖</div>
                <div class="ai-message-content-modern"><p style="white-space: pre-line;">${escapeHtml(aiResponse)}</p></div>
            `;
        } else {
            // Old UI
            aiMsgEl.className = 'ai-message ai-message-assistant';
            aiMsgEl.innerHTML = `
                <div class="ai-avatar">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
                        <circle cx="8.5" cy="8.5" r="1.5"></circle>
                        <polyline points="21 15 16 10 5 21"></polyline>
                    </svg>
                </div>
                <div class="ai-content"><p style="white-space: pre-line;">${escapeHtml(aiResponse)}</p></div>
            `;
        }
        if (messagesContainer) {
            messagesContainer.appendChild(aiMsgEl);
            messagesContainer.scrollTop = messagesContainer.scrollHeight;
        }
        playFeedback();
        animateAIBuddy('happy');
        updateAIUsageUI();
        if (sendBtn) {
            // After sending, keep disabled until user types again.
            sendBtn.disabled = true;
        }

        // Speak the response if voice output is enabled (optional feature)
        // Uncomment to enable voice output:
        // speakText(aiResponse, state.language);
    }

    async function handleProChatMessage() {
        const input = document.getElementById('prochat-input');
        const messagesContainer = document.getElementById('prochat-messages');
        if (!input || !messagesContainer) return;

        if (input.disabled) {
            updateProChatUsageUI();
            return;
        }

        const userMessage = input.value.trim();
        if (!userMessage) return;

        const usage = consumeProChatUsage();
        if (!usage.allowed) {
            appendProChatMessage('assistant', usage.message);
            updateProChatUsageUI(usage.info);
            return;
        }

        appendProChatMessage('user', userMessage);
        input.value = '';
        updateProChatUsageUI(usage.info);

        try {
            const reply = await requestDeepSeekProChatResponse(userMessage);
            const responseText = reply || 'No response received.';
            appendProChatMessage('assistant', responseText);
        } catch (error) {
            console.error('DeepSeek Pro Chat failed:', error);
            appendProChatMessage('assistant', error?.message || 'DeepSeek Pro Chat failed.');
        } finally {
            updateProChatUsageUI();
        }
    }

    function appendProChatMessage(role, text) {
        const messagesContainer = document.getElementById('prochat-messages');
        if (!messagesContainer) return;
        const emptyState = messagesContainer.querySelector('.prochat-empty');
        if (emptyState) emptyState.remove();

        const msg = document.createElement('div');
        msg.className = `prochat-message ${role}`;
        msg.innerHTML = `
            <div class="prochat-bubble">
                <p>${escapeHtml(String(text))}</p>
            </div>
        `;
        messagesContainer.appendChild(msg);
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
    }

    async function requestDeepSeekResponse(userMessage) {
        const config = getDeepSeekConfig();
        if (!config.apiKey) return null;

        const messages = buildDeepSeekMessages(userMessage, config.systemPrompt);
        const url = buildDeepSeekChatUrl(config.baseUrl);
        const payload = {
            model: config.model,
            messages,
            stream: false
        };

        const attemptRequest = async () => {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), config.timeoutMs);
            try {
                const response = await fetch(url, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        Authorization: `Bearer ${config.apiKey}`
                    },
                    body: JSON.stringify(payload),
                    signal: controller.signal
                });

                const text = await response.text();
                let data = null;
                if (text) {
                    try {
                        data = JSON.parse(text);
                    } catch (err) {
                        data = null;
                    }
                }
                return { response, data, text };
            } finally {
                clearTimeout(timeoutId);
            }
        };

        let attempt = await attemptRequest();
        if (!attempt.response.ok && (attempt.response.status >= 500 || attempt.response.status === 429)) {
            await sleep(400);
            attempt = await attemptRequest();
        }

        if (!attempt.response.ok) {
            const errorMessage = attempt.data?.error?.message || attempt.text || `DeepSeek API error (${attempt.response.status})`;
            throw new Error(errorMessage);
        }

        const content = attempt.data?.choices?.[0]?.message?.content;
        if (!content) {
            throw new Error('DeepSeek API returned an empty response.');
        }

        appendChatHistory('user', userMessage);
        appendChatHistory('assistant', content);
        saveState();
        return String(content).trim();
    }

    async function requestDeepSeekProChatResponse(userMessage) {
        const config = getDeepSeekConfig();
        if (!config.apiKey) return null;

        const env = getEnvConfig();
        const basePrompt = (env.DEEPSEEK_SYSTEM_PROMPT || ENV_DEFAULTS.DEEPSEEK_SYSTEM_PROMPT).toString().trim();
        const history = Array.isArray(state.ai.proChatHistory) ? state.ai.proChatHistory : [];
        const messages = buildDeepSeekMessagesWithHistory(userMessage, basePrompt, history);
        const url = buildDeepSeekChatUrl(config.baseUrl);
        const payload = {
            model: config.model,
            messages,
            stream: false
        };

        const attemptRequest = async () => {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), config.timeoutMs);
            try {
                const response = await fetch(url, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        Authorization: `Bearer ${config.apiKey}`
                    },
                    body: JSON.stringify(payload),
                    signal: controller.signal
                });

                const text = await response.text();
                let data = null;
                if (text) {
                    try {
                        data = JSON.parse(text);
                    } catch (err) {
                        data = null;
                    }
                }
                return { response, data, text };
            } finally {
                clearTimeout(timeoutId);
            }
        };

        let attempt = await attemptRequest();
        if (!attempt.response.ok && (attempt.response.status >= 500 || attempt.response.status === 429)) {
            await sleep(400);
            attempt = await attemptRequest();
        }

        if (!attempt.response.ok) {
            const errorMessage = attempt.data?.error?.message || attempt.text || `DeepSeek API error (${attempt.response.status})`;
            throw new Error(errorMessage);
        }

        const content = attempt.data?.choices?.[0]?.message?.content;
        if (!content) {
            throw new Error('DeepSeek API returned an empty response.');
        }

        if (!state.ai.proChatHistory || !Array.isArray(state.ai.proChatHistory)) {
            state.ai.proChatHistory = [];
        }
        state.ai.proChatHistory.push({ role: 'user', content: String(userMessage) });
        state.ai.proChatHistory.push({ role: 'assistant', content: String(content) });
        if (state.ai.proChatHistory.length > MAX_DEEPSEEK_HISTORY * 2) {
            state.ai.proChatHistory = state.ai.proChatHistory.slice(-MAX_DEEPSEEK_HISTORY * 2);
        }
        saveState();
        return String(content).trim();
    }

    async function generateAIResponse(userMessage) {
        const usage = consumeAIUsage();
        if (!usage.allowed) {
            return usage.message;
        }

        const isBangla = state.language === 'bn';
        const normalized = normalizeText(userMessage);
        const amountMatches = normalizeBanglaDigits(userMessage).match(/(\d+(?:\.\d+)?)/g) || [];
        let deepSeekReply = null;
        let deepSeekAttempted = false;

        const pendingReply = resolvePendingIntent(userMessage);
        if (pendingReply) {
            return pendingReply;
        }

        if (shouldAttemptDeepSeekFirst(normalized)) {
            deepSeekAttempted = true;
            try {
                deepSeekReply = await requestDeepSeekResponse(userMessage);
                const deepSeekActionReply = tryHandleDeepSeekActions(deepSeekReply, isBangla);
                if (deepSeekActionReply) return deepSeekActionReply;
            } catch (error) {
                console.error('DeepSeek API failed:', error);
                deepSeekReply = null;
            }
        }

        if (isCardThemeRequest(normalized)) {
            const customer = findCustomerFromText(userMessage);
            return isBangla
                ? `${customer ? `${customer.name} এর জন্য` : ''} কার্ড বানাতে পারি। কোন কাস্টমারের জন্য কার্ড বানাবো?`
                : `I can prepare a themed card${customer ? ` for ${customer.name}` : ''}. Which customer should this card be for?`;
        }

        const themeIntent = extractThemeIntent(normalized);
        if (themeIntent) {
            const resolvedTheme = themeIntent === '__cycle__'
                ? getNextThemeInCycle(state.ui.theme)
                : themeIntent;

            applyTheme(resolvedTheme);
            saveState();
            playFeedbackStrong();
            const themeLabel = getThemeFriendlyName(resolvedTheme, isBangla);
            return isBangla
                ? `ঠিক আছে, থিম ${themeLabel} করে দিলাম।`
                : `Done! Theme switched to ${themeLabel}.`;
        }

        const billItems = parseBillItemsFromText(userMessage);
        const billKeywords = ['bill', 'invoice', 'receipt', 'রসিদ', 'বিল', 'চালান'];
        const isBillRequest = billKeywords.some(keyword => normalized.includes(keyword)) || billItems.length > 1 || amountMatches.length > 1;
        if (isBillRequest && billItems.length > 0) {
            const customerGuess = findCustomerFromText(userMessage);
            const nameGuess = customerGuess?.name || extractNameFromText(userMessage);
            const paymentStatus = detectPaymentStatusFromText(userMessage);
            if (!nameGuess) {
                state.ai.pendingIntent = {
                    type: 'bill',
                    data: {
                        items: billItems,
                        customerName: '',
                        paymentStatus
                    }
                };
                return isBangla
                    ? 'রসিদ বানাচ্ছি। কার নামে বানাবো?'
                    : 'I can make this bill. Which customer should I use?';
            }
            const customer = ensureCustomerByName(nameGuess);
            const bill = autoCreateBillFromItems(billItems, customer, paymentStatus);
            const totalText = formatCurrency(bill.total);
            return isBangla
                ? `${customer.name} এর জন্য ${billItems.length} আইটেমের রসিদ তৈরি: মোট ${totalText}।`
                : `Created a ${billItems.length}-item receipt for ${customer.name}. Total ${totalText}.`;
        }

        const addCustomerMatch = userMessage.match(/(?:add|create|new)\s+(?:customer|client|buyer|গ্রাহক|কাস্টমার)\s*(.+)?/i);
        if (addCustomerMatch) {
            const guessedName = extractQuotedText(userMessage) || addCustomerMatch[1] || extractNameFromText(userMessage);
            if (!guessedName) {
                return isBangla ? 'কাস্টমারের নাম বলুন, সাথে সাথে যোগ করবো।' : 'Tell me the customer name and I will add right away.';
            }
            const customer = ensureCustomerByName(guessedName);
            return isBangla
                ? `${customer.name} কে কাস্টমার তালিকায় যোগ করেছি।`
                : `Added ${customer.name} to your customer list.`;
        }

        const deleteCustomerMatch = userMessage.match(/(?:delete|remove|drop)\s+(?:customer|client|buyer|গ্রাহক|কাস্টমার)\s+(.+)/i);
        if (deleteCustomerMatch) {
            const nameToDelete = deleteCustomerMatch[1] || extractNameFromText(userMessage);
            const removed = deleteCustomerByName(nameToDelete);
            return removed
                ? (isBangla ? `${removed.name} কে তালিকা থেকে মুছে ফেলেছি।` : `Removed ${removed.name} from your customers.`)
                : (isBangla ? 'যে কাস্টমারকে মুছতে চান তার নামটা আরেকবার বলুন।' : 'Tell me which customer to remove.');
        }

        const billPaidKeywords = ['paid bill', 'bill paid', 'invoice paid', 'paid invoice', 'payment received', 'paid receipt', 'রসিদ পরিশোধ', 'বিল পরিশোধ', 'পরিশোধ'];
        if (billPaidKeywords.some(keyword => normalized.includes(keyword)) && billKeywords.some(keyword => normalized.includes(keyword))) {
            const invoiceMatch = userMessage.match(/(?:invoice|bill|receipt)\s*#?\s*([A-Za-z0-9-]+)/i);
            const invoiceNumber = invoiceMatch?.[1] || '';
            const customerName = extractCustomerName(userMessage) || extractNameFromText(userMessage);
            if (invoiceNumber) {
                const bill = findBillByInvoiceNumber(invoiceNumber);
                if (!bill) {
                    return isBangla ? 'এই ইনভয়েস নম্বর পাইনি।' : 'I could not find that invoice number.';
                }
                if (bill.paymentStatus === 'paid') {
                    return isBangla ? 'বিলটি আগেই পরিশোধ করা আছে।' : 'That bill is already marked as paid.';
                }
                bill.paymentStatus = 'paid';
                bill.updatedAt = Date.now();
                saveState();
                renderBills();
                return isBangla
                    ? `${bill.customerName || 'বিল'} পরিশোধ হয়েছে বলে চিহ্নিত করেছি।`
                    : `Marked the bill for ${bill.customerName || 'this customer'} as paid.`;
            }
            if (customerName) {
                const outcome = markLatestBillPaidForCustomer(customerName);
                if (!outcome) {
                    return isBangla ? 'এই নামে কোনো বিল পেলাম না।' : 'I could not find a bill for that customer.';
                }
                if (outcome.status === 'already_paid') {
                    return isBangla ? 'এই কাস্টমারের সব বিল আগেই পরিশোধ করা আছে।' : 'All bills for this customer are already paid.';
                }
                return isBangla
                    ? `${outcome.bill?.customerName || 'বিল'} পরিশোধ হয়েছে বলে চিহ্নিত করেছি।`
                    : `Marked the latest bill for ${outcome.bill?.customerName || 'this customer'} as paid.`;
            }
            return isBangla ? 'কোন বিলটি পরিশোধ হয়েছে? ইনভয়েস নম্বর বা নাম বলুন।' : 'Which bill was paid? Share an invoice number or customer name.';
        }

        const debtKeywords = ['debt', 'due', 'owe', 'baki', 'দেনা', 'বাকি', 'ঋণ', 'ধার', 'পাওনা'];
        if (debtKeywords.some(keyword => normalized.includes(keyword))) {
            const parsed = parseDebtFromText(userMessage);
            if (parsed.missing.includes('customer')) {
                state.ai.pendingIntent = { type: 'add_debt', data: parsed };
                return isBangla
                    ? 'কোন কাস্টমারের জন্য বাকি যোগ করবো? নামটা বলুন।'
                    : 'Which customer should I add debt for? Please tell me the name.';
            }
            if (parsed.missing.includes('amount')) {
                state.ai.pendingIntent = { type: 'add_debt', data: parsed };
                return isBangla
                    ? 'টাকার পরিমাণটা কত হবে?'
                    : 'What amount should I record?';
            }
            const customer = parsed.customerId
                ? state.customers.find(c => c.id === parsed.customerId)
                : ensureCustomerByName(parsed.customerName);
            if (!customer) {
                state.ai.pendingIntent = { type: 'add_debt', data: parsed };
                return isBangla
                    ? 'ক্রেতার নামটা আবার বলুন।'
                    : 'Please repeat the customer name.';
            }
            const debt = autoRecordDebtEntry(customer, parsed.amount, parsed.note, parsed.date);
            const dateLabel = debt?.dueDate ? formatDisplayDate(debt.dueDate) : '';
            const noteLabel = parsed.note ? ` — ${parsed.note}` : '';
            return isBangla
                ? `${customer.name} এর জন্য ${formatCurrency(parsed.amount)} বাকি নিলাম${dateLabel ? ` — ${dateLabel}` : ''}${noteLabel}।`
                : `Recorded ${formatCurrency(parsed.amount)} debt for ${customer.name}${dateLabel ? ` — ${dateLabel}` : ''}${noteLabel}.`;
        }

        const paidKeywords = ['paid', 'clear', 'cleared', 'পরিশোধ', 'পরিশোধিত', 'মিটেছে'];
        if (paidKeywords.some(keyword => normalized.includes(keyword))) {
            const customerName = extractCustomerName(userMessage) || extractNameFromText(userMessage);
            const customer = customerName
                ? state.customers.find(c => c.name.toLowerCase().includes(customerName.toLowerCase()))
                : findCustomerFromText(userMessage);
            if (customer) {
                return summarizePaymentStatus(customer);
            }
            return isBangla ? 'কোন ক্রেতার পেমেন্ট জানতে চান? নাম বলুন।' : 'Which customer should I check for payment status?';
        }

        const summaryKeywords = ['summarize', 'summary', 'overview', 'সারাংশ', 'সারসংক্ষেপ'];
        if (summaryKeywords.some(keyword => normalized.includes(keyword))) {
            const incompleteTasks = state.tasks.filter(t => !t.done);
            const overdueTasks = incompleteTasks.filter(t => t.dueDate && new Date(t.dueDate) < new Date());
            const totalDebt = state.customers.reduce((sum, c) => sum + getCustomerOutstandingBalance(c), 0);
            if (isBangla) {
                return `আপনার ব্যবসার সারাংশ:\n• মোট বকেয়া পাওনা: ${formatCurrency(totalDebt)}\n• বাকি কাজ: ${incompleteTasks.length}টি\n• মেয়াদোত্তীর্ণ কাজ: ${overdueTasks.length}টি\n\nআপনি চাইলে আজকের সবচেয়ে জরুরি কাজটা আগে করে ফেলতে পারেন।`;
            }
            return `Here is your summary:\n• Total Outstanding Debt: ${formatCurrency(totalDebt)}\n• Pending Tasks: ${incompleteTasks.length}\n• Overdue Tasks: ${overdueTasks.length}\n\nYou could start with your most urgent task today.`;
        }

        const completeTaskMatch = userMessage.match(/(?:complete|done|finish|mark)\s+(?:task|todo)\s*(.+)?/i)
            || userMessage.match(/(?:কাজ|টাস্ক)\s*(?:শেষ|কমপ্লিট|সম্পন্ন)\s*(.+)?/i);
        if (completeTaskMatch) {
            const targetTitle = completeTaskMatch[1] || extractQuotedText(userMessage);
            const completedTask = completeTaskByText(targetTitle || '');
            return completedTask
                ? (isBangla ? `"${completedTask.name}" কাজটি শেষ করেছি।` : `Marked "${completedTask.name}" as done.`)
                : (isBangla ? 'কোন কাজটি শেষ করতে চান?' : 'Which task should I mark as done?');
        }

        const deleteTaskMatch = userMessage.match(/(?:delete|remove)\s+(?:task|todo)\s*(.+)?/i);
        if (deleteTaskMatch) {
            const targetTitle = deleteTaskMatch[1] || extractQuotedText(userMessage);
            const removedTask = deleteTaskByText(targetTitle || '');
            return removedTask
                ? (isBangla ? `"${removedTask.name}" টাস্ক মুছে দিয়েছি।` : `Removed the task "${removedTask.name}".`)
                : (isBangla ? 'কোন টাস্কটি মুছবো? নাম বলুন।' : 'Which task should I remove?');
        }

        const showTaskKeywords = ['show', 'list', 'view', 'দেখাও', 'তালিকা'];
        const taskKeywords = ['task', 'tasks', 'todo', 'কাজ', 'টাস্ক'];
        if (showTaskKeywords.some(keyword => normalized.includes(keyword)) && taskKeywords.some(keyword => normalized.includes(keyword))) {
            const incompleteTasks = state.tasks.filter(t => !t.done);
            if (incompleteTasks.length === 0) {
                return isBangla
                    ? 'আপনার কোনো বাকি কাজ নেই। দারুণ!'
                    : 'You have no pending tasks. Great job staying organized.';
            }
            const locale = isBangla ? 'bn-BD' : 'en-US';
            let taskList = isBangla
                ? `আপনার ${incompleteTasks.length}টি বাকি কাজ আছে:\n\n`
                : `You have ${incompleteTasks.length} pending task(s):\n\n`;
            incompleteTasks.forEach((task, i) => {
                const dueDate = task.dueDate ? new Date(task.dueDate).toLocaleDateString(locale) : '';
                taskList += `${i + 1}. ${task.name}${dueDate ? (isBangla ? ` (শেষ তারিখ: ${dueDate})` : ` (Due: ${dueDate})`) : ''}\n`;
            });
            return taskList;
        }

        if (taskKeywords.some(keyword => normalized.includes(keyword))) {
            const parsed = parseTaskFromText(userMessage);
            if (parsed.missing.includes('title')) {
                state.ai.pendingIntent = { type: 'add_task', data: parsed };
                return isBangla
                    ? 'কোন কাজটি যোগ করবো? ছোট করে বলুন।'
                    : 'Which task should I add?';
            }
            autoCreateTaskEntry({
                title: parsed.title,
                date: parsed.date,
                time: parsed.time,
                note: parsed.note
            });
            const dateLabel = parsed.date ? formatDisplayDate(parsed.date) : '';
            const timeLabel = parsed.time ? ` ${parsed.time}` : '';
            return isBangla
                ? `টাস্ক "${parsed.title}" যোগ করা হয়েছে${dateLabel ? ` — ${dateLabel}` : ''}${timeLabel}.`
                : `Added the task "${parsed.title}"${dateLabel ? ` — ${dateLabel}` : ''}${timeLabel}.`;
        }

        const noteKeywords = ['note', 'memo', 'নোট'];
        if (noteKeywords.some(keyword => normalized.includes(keyword))) {
            const noteText = extractNoteText(userMessage);
            if (!noteText) {
                return isBangla
                    ? 'কী নোট লিখবো? ছোট করে বলুন।'
                    : 'What note should I write?';
            }
            openNoteModalPrefill(noteText, '');
            return isBangla
                ? `নোট "${noteText}" তৈরি করেছি। ঠিক থাকলে সেভ করবেন?`
                : `I prepared the note "${noteText}". Please confirm before saving.`;
        }

        const trustKeywords = ['trust', 'ratio', 'reliability', 'ট্রাস্ট', 'বিশ্বাস', 'বিশ্বাসযোগ্যতা'];
        if (trustKeywords.some(keyword => normalized.includes(keyword))) {
            const customerName = extractCustomerName(userMessage);
            const customer = customerName
                ? state.customers.find(c => c.name.toLowerCase().includes(customerName.toLowerCase()))
                : findCustomerFromText(userMessage);
            if (customer) {
                const trustRatio = calculateTrustRatio(customer);
                return isBangla
                    ? `${customer.name} এর ট্রাস্ট রেশিও ${trustRatio}%. ${getTrustRatioExplanation(trustRatio)}`
                    : `The trust ratio for ${customer.name} is ${trustRatio}%. ${getTrustRatioExplanation(trustRatio)}`;
            }
            return isBangla
                ? 'ক্রেতার ট্রাস্ট রেশিও জানতে বলুন: "[ক্রেতার নাম] এর ট্রাস্ট রেশিও কত?"'
                : 'To see a customer\'s trust ratio, ask: "What is the trust ratio for [customer name]?"';
        }

        const pendingKeywords = ['remaining', 'left', 'pending', 'বাকি'];
        if (pendingKeywords.some(keyword => normalized.includes(keyword)) && taskKeywords.some(keyword => normalized.includes(keyword))) {
            const incompleteTasks = state.tasks.filter(t => !t.done);
            const todayDate = todayString();
            const todayTasks = incompleteTasks.filter(t => t.dueDate === todayDate);
            const overdueTasks = incompleteTasks.filter(t => t.dueDate && t.dueDate < todayDate);

            let response = isBangla ? `কাজের সারাংশ:\n` : `Task Summary:\n`;
            response += isBangla ? `• মোট বাকি: ${incompleteTasks.length}\n` : `• Total pending: ${incompleteTasks.length}\n`;
            response += isBangla ? `• আজকের: ${todayTasks.length}\n` : `• Due today: ${todayTasks.length}\n`;
            response += isBangla ? `• মেয়াদোত্তীর্ণ: ${overdueTasks.length}\n` : `• Overdue: ${overdueTasks.length}\n`;

            if (todayTasks.length > 0) {
                response += isBangla ? `\nআজকের কাজ:\n` : `\nToday's tasks:\n`;
                todayTasks.forEach((task, i) => {
                    response += `${i + 1}. ${task.name}\n`;
                });
            }
            return response;
        }

        const predictionKeywords = ['predict', 'late', 'payment prediction', 'দেরি', 'লেট'];
        if (predictionKeywords.some(keyword => normalized.includes(keyword))) {
            return generatePaymentPrediction();
        }

        if (normalized.includes('stats')) {
            return buildAISummary();
        }

        const remainingInfo = usage.info;
        const remainingText = remainingInfo.limit === Infinity
            ? (isBangla ? 'এআই ব্যবহার: আনলিমিটেড' : 'AI usage: Unlimited')
            : remainingInfo.plan === 'max'
                ? (isBangla ? `এই সাইকেলে বাকি: ${remainingInfo.remaining} বার` : `Remaining this cycle: ${remainingInfo.remaining} uses`)
                : (isBangla ? `আজ বাকি: ${remainingInfo.remaining} বার` : `Remaining today: ${remainingInfo.remaining} uses`);

        if (!deepSeekAttempted && hasDeepSeekKey()) {
            try {
                deepSeekReply = await requestDeepSeekResponse(userMessage);
                if (deepSeekReply) {
                    const deepSeekActionReply = tryHandleDeepSeekActions(deepSeekReply, isBangla);
                    if (deepSeekActionReply) return deepSeekActionReply;
                    return deepSeekReply;
                }
            } catch (error) {
                console.error('DeepSeek API failed:', error);
                return isBangla
                    ? `DeepSeek API কাজ করেনি। কারণ: ${error?.message || 'অজানা সমস্যা'}`
                    : `DeepSeek API failed. Reason: ${error?.message || 'Unknown error'}`;
            }
        }

        if (deepSeekReply) return deepSeekReply;

        return isBangla
            ? `আমি সাহায্য করতে পারি:\n- বিল/রসিদ বানানো\n- ক্রেতা যোগ বা মুছে ফেলা\n- বাকি যোগ ও পেমেন্ট স্ট্যাটাস বলা\n- টাস্ক যোগ/ডিলিট\n- নোট ও থিম বদল\n- ট্রাস্ট রেশিও\n\n${remainingText}`
            : `I can help you with:\n- Create bills/receipts\n- Add or remove customers\n- Add debts and report payment status\n- Add/delete tasks\n- Notes, themes, and trust ratio\n\n${remainingText}`;
    }

    function generatePaymentPrediction() {
        const isBangla = state.language === 'bn';
        const predictions = [];
        const today = new Date();

        state.customers.forEach(customer => {
            if (customer.debts.length === 0) return;

            const trustRatio = calculateTrustRatio(customer);
            const overdueDebts = customer.debts.filter(d => {
                if (!d.dueDate) return false;
                return new Date(d.dueDate) < today && getDebtOutstanding(d) > 0;
            });

            const latePayments = customer.payments.filter(p => {
                const relatedDebt = customer.debts.find(d =>
                    d.dueDate && new Date(p.date) > new Date(d.dueDate)
                );
                return relatedDebt;
            }).length;

            const totalPayments = customer.payments.length;
            const lateRate = totalPayments > 0 ? (latePayments / totalPayments) * 100 : 0;

            if (trustRatio < 60 || lateRate > 30 || overdueDebts.length > 0) {
                let riskLevel = 'Medium';
                if (trustRatio < 40 || lateRate > 50) riskLevel = 'High';
                else if (trustRatio >= 60 && lateRate < 20) riskLevel = 'Low';

                predictions.push({
                    name: customer.name,
                    trustRatio,
                    lateRate,
                    overdueCount: overdueDebts.length,
                    riskLevel,
                    balance: getCustomerBalance(customer)
                });
            }
        });

        if (predictions.length === 0) {
            return isBangla
                ? 'দারুণ খবর! পেমেন্ট ইতিহাস অনুযায়ী সবাই সময়মতো পরিশোধ করার সম্ভাবনা বেশি।'
                : 'Great news! Based on payment history, all your customers are likely to pay on time. No high-risk customers detected.';
        }

        predictions.sort((a, b) => {
            if (a.riskLevel === 'High' && b.riskLevel !== 'High') return -1;
            if (b.riskLevel === 'High' && a.riskLevel !== 'High') return 1;
            return a.trustRatio - b.trustRatio;
        });

        let response = isBangla
            ? `[এআই পেমেন্ট পূর্বাভাস]\n\nপেমেন্টে দেরি হতে পারে এমন ক্রেতারা:\n\n`
            : `[AI Payment Prediction]\n\nBased on payment history analysis, here are customers who may pay late:\n\n`;
        predictions.forEach((pred, i) => {
            const riskLabel = isBangla
                ? (pred.riskLevel === 'High' ? 'উচ্চ' : pred.riskLevel === 'Medium' ? 'মাঝারি' : 'কম')
                : pred.riskLevel;
            response += `${i + 1}. ${pred.name}\n`;
            response += isBangla
                ? `   ঝুঁকির মাত্রা: ${riskLabel}\n   ট্রাস্ট রেশিও: ${pred.trustRatio}%\n   দেরি করার হার: ${pred.lateRate.toFixed(1)}%\n   বাকি দেনা: ${pred.overdueCount}\n   বর্তমান বাকি: ${formatCurrency(pred.balance)}\n\n`
                : `   Risk Level: ${riskLabel}\n   Trust Ratio: ${pred.trustRatio}%\n   Late Payment Rate: ${pred.lateRate.toFixed(1)}%\n   Overdue Debts: ${pred.overdueCount}\n   Current Balance: ${formatCurrency(pred.balance)}\n\n`;
        });

        return response;
    }

    let recognition = null;
    let isRecording = false;

    function startVoiceInput(type) {
        if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
            alert(state.language === 'bn'
                ? 'আপনার ব্রাউজার ভয়েস ইনপুট সমর্থন করে না। Chrome বা Edge ব্যবহার করুন।'
                : 'Your browser does not support voice input. Please use Chrome or Edge.');
            return;
        }

        if (type === 'ai') {
            const usage = getAIUsageInfo();
            if (usage.limit !== Infinity && usage.remaining <= 0) {
                updateAIUsageUI(usage);
                return;
            }
        }

        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (!recognition) {
            recognition = new SpeechRecognition();
            recognition.continuous = false;
            recognition.interimResults = false;
        }
        recognition.lang = state.language === 'bn' ? 'bn-BD' : 'en-US';

        if (isRecording) {
            recognition.stop();
            isRecording = false;
            updateVoiceButtonState(type, false);
            return;
        }

        isRecording = true;
        updateVoiceButtonState(type, true);

        recognition.onresult = (event) => {
            const transcript = event.results[0][0].transcript;
            processVoiceInput(transcript, type);
            isRecording = false;
            updateVoiceButtonState(type, false);
        };

        recognition.onerror = (event) => {
            console.error('Speech recognition error:', event.error);
            isRecording = false;
            updateVoiceButtonState(type, false);
            if (event.error === 'no-speech') {
                // Silent fail or toast
            }
        };

        recognition.onend = () => {
            isRecording = false;
            updateVoiceButtonState(type, false);
        };

        recognition.start();
    }

    function updateVoiceButtonState(type, recording) {
        const buttons = document.querySelectorAll(`[data-voice-target="${type}"]`);
        const overlay = document.getElementById('voice-overlay');

        buttons.forEach(btn => {
            btn.classList.toggle('recording', recording);
            btn.classList.toggle('listening', recording);
        });

        // Animate AI buddy when listening
        if (type === 'ai') {
            animateAIBuddy(recording ? 'listening' : 'idle');
        }

        // Toggle overlay for all voice input types
        if (overlay) {
            if (recording) overlay.classList.add('active');
            else overlay.classList.remove('active');
        }
    }

    function processVoiceInput(transcript, type) {
        if (type === 'ai') {
            const aiInput = document.getElementById('ai-input');
            if (aiInput) {
                aiInput.value = transcript;
                setTimeout(() => handleAIMessage(), 200);
            }
        } else if (type === 'debt') {
            const fallbackCustomerId = forms.debt?.elements?.customerId?.value || '';
            const payload = parseDebtFromText(transcript, { customerId: fallbackCustomerId });
            if (forms.debt) {
                forms.debt.reset();
                populateDebtCustomerSelect();
                if (payload.customerId && forms.debt.elements.customerId) {
                    forms.debt.elements.customerId.value = payload.customerId;
                }
                if (payload.amount && forms.debt.elements.amount) {
                    forms.debt.elements.amount.value = payload.amount;
                }
                if (payload.note && forms.debt.elements.description) {
                    forms.debt.elements.description.value = payload.note;
                }
                if (forms.debt.elements.date) {
                    forms.debt.elements.date.value = payload.date || todayString();
                }
            }
            showDebtVoicePreview(payload);
            playFeedback();
        } else if (type === 'task') {
            const payload = parseTaskFromText(transcript);
            openTaskModalPrefill(payload.title || '', payload.date, payload.time, payload.note);
            showTaskVoicePreview(payload);
            playFeedback();
        }
    }

    function extractCustomerName(message) {
        const patterns = [
            /(?:for|of|about)\s+([A-Za-z\s]+?)(?:\s|$|\.|,)/i,
            /"([^"]+)"/,
            /'([^']+)'/
        ];
        for (const pattern of patterns) {
            const match = message.match(pattern);
            if (match) return match[1].trim();
        }
        return null;
    }

    function calculateTrustRatio(customer) {
        if (!customer || customer.debts.length === 0) return 100;

        const totalDebts = customer.debts.length;
        const paidDebts = customer.debts.filter(d => getDebtOutstanding(d) <= 0).length;
        const onTimePayments = customer.payments.filter(p => {
            const debt = customer.debts.find(d => d.dueDate && new Date(p.date) <= new Date(d.dueDate));
            return debt;
        }).length;

        const paymentRatio = totalDebts > 0 ? (paidDebts / totalDebts) * 50 : 0;
        const timelinessRatio = totalDebts > 0 ? (onTimePayments / totalDebts) * 50 : 0;

        return Math.round(paymentRatio + timelinessRatio);
    }

    function getTrustRatioExplanation(ratio) {
        if (state.language === 'bn') {
            if (ratio >= 90) return 'চমৎকার! এই ক্রেতা খুবই নির্ভরযোগ্য।';
            if (ratio >= 70) return 'ভালো। সাধারণত নির্ভরযোগ্য।';
            if (ratio >= 50) return 'মোটামুটি। পেমেন্টে একটু নজর রাখুন।';
            return 'কম। সতর্ক থাকা ভালো।';
        }
        if (ratio >= 90) return 'Excellent! This customer is very reliable.';
        if (ratio >= 70) return 'Good. This customer is generally reliable.';
        if (ratio >= 50) return 'Fair. Keep an eye on payments.';
        return 'Low. Consider being cautious with this customer.';
    }

    function showMonthlyWrap() {
        const modal = modals.monthlyWrap;
        const content = document.getElementById('monthly-wrap-content');
        if (!modal || !content) return;

        const now = new Date();
        const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
        const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);

        const monthBills = (state.bills || []).filter(b => {
            const billDate = new Date(b.date);
            return billDate >= monthStart && billDate <= monthEnd;
        });

        const monthPayments = state.customers.flatMap(c =>
            c.payments.filter(p => {
                const payDate = new Date(p.date);
                return payDate >= monthStart && payDate <= monthEnd;
            })
        );

        const totalRevenue = monthBills.reduce((sum, b) => sum + b.total, 0);
        const totalPayments = monthPayments.reduce((sum, p) => sum + p.amount, 0);
        const totalCustomers = new Set(monthBills.map(b => b.customerName)).size;

        content.innerHTML = `
            <div class="monthly-wrap-card">
                <h3>${now.toLocaleString('default', { month: 'long', year: 'numeric' })} Summary</h3>
                <div class="monthly-wrap-stats">
                    <div class="monthly-wrap-stat">
                        <div class="monthly-wrap-stat-value">${formatCurrency(totalRevenue)}</div>
                        <div class="monthly-wrap-stat-label">Total Revenue</div>
                    </div>
                    <div class="monthly-wrap-stat">
                        <div class="monthly-wrap-stat-value">${formatCurrency(totalPayments)}</div>
                        <div class="monthly-wrap-stat-label">Payments Received</div>
                    </div>
                    <div class="monthly-wrap-stat">
                        <div class="monthly-wrap-stat-value">${monthBills.length}</div>
                        <div class="monthly-wrap-stat-label">Bills Generated</div>
                    </div>
                    <div class="monthly-wrap-stat">
                        <div class="monthly-wrap-stat-value">${totalCustomers}</div>
                        <div class="monthly-wrap-stat-label">Active Customers</div>
                    </div>
                </div>
            </div>
        `;

        modal.showModal();
    }


    function applyTextSize(size) {
        document.documentElement.dataset.textSize = size;
    }

    function applyDockScale(scale) {
        const normalized = clampNumber(Number(scale) || 1, 0.6, 1.15); // Range: 0.6 (compact) to 1.15 (large)
        // #region agent log
        fetch('http://127.0.0.1:7244/ingest/7591a081-794e-4c95-addc-58f3e67a995c', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ location: 'app.js:6423', message: 'applyDockScale called', data: { input: scale, normalized }, timestamp: Date.now(), sessionId: 'debug-session', runId: 'run1', hypothesisId: 'H3' }) }).catch(() => { });
        // #endregion
        console.log('applyDockScale:', { input: scale, normalized });
        document.documentElement.style.setProperty('--dock-scale', normalized);
        // #region agent log
        fetch('http://127.0.0.1:7244/ingest/7591a081-794e-4c95-addc-58f3e67a995c', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ location: 'app.js:6427', message: 'CSS variable set', data: { cssVarValue: getComputedStyle(document.documentElement).getPropertyValue('--dock-scale') }, timestamp: Date.now(), sessionId: 'debug-session', runId: 'run1', hypothesisId: 'H3' }) }).catch(() => { });
        // #endregion
        return normalized;
    }

    function applyUiScale(scale) {
        const normalized = clampNumber(Number(scale) || 1, 0.8, 1.0);
        document.documentElement.style.setProperty('--ui-scale', normalized);
        return normalized;
    }

    function applyViewMode(mode) {
        const normalized = mode === 'desktop' ? 'desktop' : 'phone';
        state.ui.viewMode = normalized;
        document.body.dataset.view = normalized;
        return normalized;
    }

    function applyTodoMode(isSimple) {
        const simplePanel = document.getElementById('todo-simple');
        const advancedPanel = document.getElementById('todo-app-advanced');

        if (simplePanel) simplePanel.hidden = !isSimple;
        if (advancedPanel) advancedPanel.hidden = !!isSimple;

        if (isSimple) {
            renderSimpleTodoList();
        } else {
            renderNewTodoList(getCurrentTodoCategory());
        }
        updateTodoStats();
    }

    // Calculator Functions
    function initCalculator() {
        if (!selectors.calculatorButtons) return;

        selectors.calculatorButtons.forEach(btn => {
            btn.addEventListener('click', () => {
                const value = btn.dataset.value;
                const action = btn.dataset.action;

                if (action) {
                    handleCalculatorAction(action);
                } else if (value) {
                    handleCalculatorInput(value);
                }
            });
        });

        updateCalculatorDisplay();
    }

    function handleCalculatorInput(value) {
        if (!state.calculator.expression) {
            state.calculator.expression = value;
        } else {
            state.calculator.expression += value;
        }
        calculateResult();
        updateCalculatorDisplay();
    }

    function handleCalculatorAction(action) {
        switch (action) {
            case 'clear':
                state.calculator.expression = state.calculator.expression.slice(0, -1);
                break;
            case 'clear-all':
                state.calculator.expression = '';
                state.calculator.result = '0';
                break;
            case 'backspace':
                state.calculator.expression = state.calculator.expression.slice(0, -1);
                break;
            case 'equals':
                state.calculator.expression = state.calculator.result;
                break;
        }
        calculateResult();
        updateCalculatorDisplay();
    }

    function calculateResult() {
        try {
            if (!state.calculator.expression) {
                state.calculator.result = '0';
                return;
            }
            const expr = state.calculator.expression.replace(/×/g, '*').replace(/÷/g, '/').replace(/−/g, '-');
            const result = Function('"use strict"; return (' + expr + ')')();
            state.calculator.result = result.toString();
        } catch (e) {
            state.calculator.result = 'Error';
        }
    }

    function updateCalculatorDisplay() {
        if (selectors.calcExpression) {
            selectors.calcExpression.textContent = state.calculator.expression || '';
        }
        if (selectors.calcResult) {
            selectors.calcResult.textContent = state.calculator.result || '0';
        }
    }

    // AI Tools Functions
    function initAITools() {
        // AI Chat: Ultra only; ensureAIChatAccessible() shows chat for Ultra, subscription message for others
        ensureAIChatAccessible();
        ensureProChatAccessible();

        // AI tools tab switching
        const aiTabBtns = document.querySelectorAll('.ai-tab-btn');
        const aiToolPanels = document.querySelectorAll('.ai-tool-panel');

        aiTabBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                const targetTab = btn.dataset.aiTab;

                // Update active tab button
                aiTabBtns.forEach(b => b.classList.remove('active'));
                btn.classList.add('active');

                // Update active panel
                aiToolPanels.forEach(panel => {
                    panel.classList.remove('active');
                    if (panel.id === `ai-${targetTab}-panel`) {
                        panel.classList.add('active');
                    }
                });

                // AI Chat tab: Ultra sees chat; non-Ultra sees subscription upsell (trust ratio available when user asks, in Ultra)
                if (targetTab === 'chat') ensureAIChatAccessible();
                if (targetTab === 'prochat') ensureProChatAccessible();
            });
        });

        const proChatSendBtn = document.getElementById('prochat-send-btn');
        const proChatInput = document.getElementById('prochat-input');
        if (proChatSendBtn && proChatInput) {
            proChatSendBtn.addEventListener('click', () => handleProChatMessage());
            proChatInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    handleProChatMessage();
                }
            });
        }

        // Populate customer and logo dropdowns
        populateCardCustomerSelect();
        populateCardLogoSelect();

        // Customer selection change handler
        const customerSelect = document.getElementById('card-customer-select');
        if (customerSelect) {
            customerSelect.addEventListener('change', (e) => {
                const customerId = e.target.value;
                if (customerId) {
                    const customer = state.customers.find(c => c.id === customerId);
                    if (customer) {
                        prefillDebtCardForm(customer);
                    }
                }
                updateDebtCardPreview();
            });
        }

        // Debt card generator
        const debtCardForm = document.getElementById('debt-card-form');
        if (debtCardForm) {
            const shopNameInput = debtCardForm.querySelector('input[name="shopName"]');
            if (shopNameInput && !shopNameInput.value) {
                shopNameInput.value = state.shop?.shopName || '';
            }

            const paymentMethodSelect = debtCardForm.querySelector('select[name="paymentMethod"]');
            const paymentNumberInput = debtCardForm.querySelector('input[name="paymentNumber"]');
            if (paymentMethodSelect) {
                paymentMethodSelect.addEventListener('change', () => {
                    if (paymentNumberInput && !paymentNumberInput.value) {
                        paymentNumberInput.value = getPaymentNumberForMethod(paymentMethodSelect.value);
                    }
                    updateDebtCardPreview();
                });
            }

            debtCardForm.addEventListener('submit', generateDebtCard);
            debtCardForm.addEventListener('input', debounce(() => {
                updateDebtCardPreview();
            }, 120));
            debtCardForm.addEventListener('change', () => {
                updateDebtCardPreview();
            });

            updateDebtCardPreview();

            const presetButtons = document.querySelectorAll('.message-preset-btn');
            presetButtons.forEach(btn => {
                btn.addEventListener('click', () => {
                    const message = state.language === 'bn'
                        ? (btn.dataset.messageBn || btn.dataset.message || '')
                        : (btn.dataset.message || btn.dataset.messageBn || '');
                    const messageField = debtCardForm.querySelector('textarea[name="customMessage"]');
                    if (!messageField) return;
                    messageField.value = message;
                    updateDebtCardPreview();
                    playFeedback();
                });
            });
        }

        // Download and share buttons
        const downloadPngBtn = document.getElementById('download-debt-card-png-btn');
        const downloadPdfBtn = document.getElementById('download-debt-card-pdf-btn');
        const shareBtn = document.getElementById('share-debt-card-btn');

        downloadPngBtn?.addEventListener('click', async () => {
            try {
                await downloadDebtCardPng();
                playFeedback();
            } catch (err) {
                console.error('Debt card PNG download failed', err);
                if (typeof alert !== 'undefined') alert(err?.message || 'Could not download PNG. Please try again.');
            }
        });

        downloadPdfBtn?.addEventListener('click', async () => {
            try {
                await downloadDebtCardPdf();
                playFeedback();
            } catch (err) {
                console.error('Debt card PDF download failed', err);
                if (typeof alert !== 'undefined') alert(err?.message || 'Could not download PDF. Please try again.');
            }
        });

        shareBtn?.addEventListener('click', async () => {
            try {
                await shareDebtCard();
                playFeedback();
            } catch (err) {
                console.error('Debt card share failed', err);
                if (typeof alert !== 'undefined') alert(err?.message || 'Share failed. Please try again.');
            }
        });
    }

    function populateCardCustomerSelect() {
        const customerSelect = document.getElementById('card-customer-select');
        if (customerSelect) {
            // Clear existing options except the first one
            while (customerSelect.options.length > 1) {
                customerSelect.remove(1);
            }

            // Add customers
            state.customers.forEach(customer => {
                const option = document.createElement('option');
                option.value = customer.id;
                option.textContent = customer.name;
                customerSelect.appendChild(option);
            });
        }
        populateDebtCustomerSelect();
    }

    function populateDebtCustomerSelect() {
        const debtSelect = document.getElementById('debt-customer-select');
        if (!debtSelect) return;

        const currentValue = debtSelect.value;
        while (debtSelect.options.length > 1) {
            debtSelect.remove(1);
        }
        state.customers.forEach(customer => {
            const option = document.createElement('option');
            option.value = customer.id;
            option.textContent = customer.name;
            debtSelect.appendChild(option);
        });
        if (currentValue) {
            debtSelect.value = currentValue;
        }
    }

    function populateCardLogoSelect() {
        const logoSelect = document.getElementById('card-logo-select');
        if (!logoSelect) return;

        // Clear existing options except the first one
        while (logoSelect.options.length > 1) {
            logoSelect.remove(1);
        }

        // Add logos
        if (state.shopLogos && state.shopLogos.length > 0) {
            state.shopLogos.forEach(logo => {
                const option = document.createElement('option');
                option.value = logo.id;
                option.textContent = logo.name;
                logoSelect.appendChild(option);
            });
        }
    }

    function getCustomerOutstandingBalance(customer) {
        return roundMoney((customer.debts || []).reduce((sum, debt) => {
            const normalized = normalizeDebtRecord(debt, customer);
            return sum + getDebtOutstanding(normalized);
        }, 0));
    }

    function getCustomerNextDueDate(customer) {
        const dueInfo = getCustomerDueInfo(customer);
        return dueInfo.nextDueDate || todayString();
    }

    function getPaymentNumberForMethod(method) {
        const key = (method || '').toLowerCase();
        const methodNumber = state.shop?.paymentMethods?.[key]?.number;
        return methodNumber || state.shop?.paymentNumber || '';
    }

    function normalizePaymentMethodLabel(method) {
        const key = (method || '').toLowerCase();
        const map = {
            bkash: 'bKash',
            nagad: 'Nagad',
            rocket: 'Rocket',
            cash: 'Cash',
            bank: 'Bank Transfer'
        };
        return map[key] || method || '';
    }

    function prefillDebtCardForm(customer) {
        const customerNameInput = document.querySelector('#debt-card-form input[name="customerName"]');
        const debtAmountInput = document.querySelector('#debt-card-form input[name="debtAmount"]');
        const dueDateInput = document.querySelector('#debt-card-form input[name="dueDate"]');
        const paymentMethodInput = document.querySelector('#debt-card-form select[name="paymentMethod"]');
        const paymentNumberInput = document.querySelector('#debt-card-form input[name="paymentNumber"]');

        if (customerNameInput) customerNameInput.value = customer.name;
        if (debtAmountInput) debtAmountInput.value = getCustomerOutstandingBalance(customer) || '';
        if (dueDateInput) dueDateInput.value = getCustomerNextDueDate(customer);
        if (paymentMethodInput && !paymentMethodInput.value) {
            paymentMethodInput.value = normalizePaymentMethodLabel(state.shop?.paymentOption || paymentMethodInput.value);
        }
        if (paymentNumberInput && !paymentNumberInput.value) {
            paymentNumberInput.value = getPaymentNumberForMethod(paymentMethodInput?.value || '');
        }
    }

    function buildDebtCardPayload(formData) {
        const selectedCustomerId = formData.get('selectedCustomer');
        const selectedLogoId = formData.get('selectedLogo');
        const selectedCustomer = state.customers.find(c => c.id === selectedCustomerId);
        const customerNameInput = (formData.get('customerName') || '').toString().trim();
        const customerName = customerNameInput || selectedCustomer?.name || '';
        const rawAmount = Number(formData.get('debtAmount')) || 0;
        const outstandingAmount = selectedCustomer ? getCustomerOutstandingBalance(selectedCustomer) : 0;
        const debtAmount = Math.max(0, rawAmount || outstandingAmount);
        const shopName = (formData.get('shopName') || state.shop.shopName || 'Your Shop').toString();
        const paymentMethod = normalizePaymentMethodLabel(formData.get('paymentMethod') || state.shop?.paymentOption || '');
        const paymentNumber = (formData.get('paymentNumber') || getPaymentNumberForMethod(paymentMethod)).toString();
        const dueDate = (formData.get('dueDate') || (selectedCustomer ? getCustomerNextDueDate(selectedCustomer) : '')).toString();
        const cardColor = (formData.get('cardColor') || '#22c55e').toString();
        const cardStyle = (formData.get('cardStyle') || 'classic').toString();
        const customMessage = (formData.get('customMessage') || '').toString();

        return {
            selectedLogoId,
            selectedCustomer,
            customerName,
            debtAmount,
            shopName,
            paymentMethod,
            paymentNumber,
            dueDate,
            cardColor,
            cardStyle,
            customMessage
        };
    }

    function updateDebtCardPreview() {
        const debtCardForm = document.getElementById('debt-card-form');
        if (!debtCardForm) return;
        const payload = buildDebtCardPayload(new FormData(debtCardForm));
        renderDebtCardPreview(payload, { scroll: false });
    }

    function renderDebtCardPreview(payload, { scroll } = {}) {
        const cardContent = document.getElementById('generated-card-content');
        const cardPreview = document.getElementById('debt-card-preview');
        if (!cardContent || !cardPreview) return false;

        const hasContent = payload.customerName || payload.debtAmount > 0;
        if (!hasContent) {
            cardPreview.hidden = true;
            return false;
        }

        const logoHTML = resolveCardLogo(payload.selectedLogoId);
        const dueDateFormatted = payload.dueDate
            ? new Date(payload.dueDate).toLocaleDateString(state.language === 'bn' ? 'bn-BD' : 'en-US', {
                year: 'numeric',
                month: 'long',
                day: 'numeric'
            })
            : '';
        const daysLeft = payload.dueDate ? daysUntil(payload.dueDate) : null;
        const dueBadge = Number.isFinite(daysLeft) ? formatDaysLeftText(daysLeft) : '';
        let dueStatus = '';
        if (Number.isFinite(daysLeft)) {
            if (daysLeft < 0) dueStatus = 'overdue';
            else if (daysLeft === 0) dueStatus = 'due-today';
            else if (daysLeft <= 2) dueStatus = 'due-soon';
        }

        const amountText = payload.debtAmount > 0 ? formatCurrency(payload.debtAmount) : '৳0';

        const cardHTML = `
            <div class="card-top-row">
                <span class="card-badge">${translate('ai.reminderBadge') || 'Payment Reminder'}</span>
                ${dueBadge ? `<span class="card-due-pill ${dueStatus}">${escapeHtml(dueBadge)}</span>` : ''}
            </div>
            <div class="card-header">
                <div class="card-brand">
                    <p class="card-shop-name">${escapeHtml(payload.shopName)}</p>
                    <p class="card-tagline">${translate('ai.reminderTagline') || ''}</p>
                </div>
                ${logoHTML}
            </div>
            <div class="card-body">
                <p class="card-customer-name"><span>${translate('ai.customerName')}:</span> ${escapeHtml(payload.customerName || '')}</p>
                <p class="card-debt-amount">${escapeHtml(amountText)}</p>
                <div class="card-details">
                    ${payload.paymentMethod ? `
                    <div class="card-detail-row">
                        <span>${translate('ai.paymentMethod')}:</span>
                        <strong>${escapeHtml(payload.paymentMethod)}</strong>
                    </div>
                    ` : ''}
                    ${payload.paymentNumber ? `
                    <div class="card-detail-row">
                        <span>${translate('ai.paymentNumber')}:</span>
                        <strong>${escapeHtml(payload.paymentNumber)}</strong>
                    </div>
                    ` : ''}
                    ${dueDateFormatted ? `
                    <div class="card-detail-row">
                        <span>${translate('ai.dueDate')}:</span>
                        <strong>${dueDateFormatted}</strong>
                    </div>
                    ` : ''}
                </div>
                ${payload.customMessage ? `<p class="card-message">"${escapeHtml(payload.customMessage)}"</p>` : ''}
            </div>
        `;

        cardContent.innerHTML = cardHTML;
        const accent = payload.cardColor;
        const accentStrong = adjustColor(payload.cardColor, -30);
        cardContent.dataset.style = payload.cardStyle || 'classic';
        cardContent.style.setProperty('--card-accent', accent);
        cardContent.style.setProperty('--card-accent-strong', accentStrong);
        if (payload.cardStyle === 'minimal') {
            cardContent.style.background = '#ffffff';
            cardContent.style.color = '#0f172a';
        } else if (payload.cardStyle === 'modern') {
            cardContent.style.background = `linear-gradient(135deg, ${accent}, ${accentStrong})`;
            cardContent.style.color = '#ffffff';
        } else {
            cardContent.style.background = `linear-gradient(135deg, ${accent}, ${adjustColor(payload.cardColor, -20)})`;
            cardContent.style.color = '#ffffff';
        }
        cardPreview.hidden = false;
        if (scroll) {
            cardPreview.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }
        return true;
    }

    function resolveCardLogo(selectedLogoId) {
        if (selectedLogoId) {
            const selectedLogo = state.shopLogos.find(l => l.id === selectedLogoId);
            if (selectedLogo && selectedLogo.image) {
                return `<img src="${selectedLogo.image}" alt="Shop Logo" style="width: 60px; height: 60px; border-radius: 8px; object-fit: cover;">`;
            }
        }
        if (state.shop.shopLogo) {
            return `<img src="${state.shop.shopLogo}" alt="Shop Logo" style="width: 60px; height: 60px; border-radius: 8px; object-fit: cover;">`;
        }
        return '<div class="card-logo">💳</div>';
    }

    function generateDebtCard(event) {
        event.preventDefault();


        const payload = buildDebtCardPayload(new FormData(event.target));
        renderDebtCardPreview(payload, { scroll: true });
    }

    function adjustColor(color, percent) {
        // Convert hex to RGB
        const num = parseInt(color.replace('#', ''), 16);
        const r = Math.max(0, Math.min(255, (num >> 16) + percent));
        const g = Math.max(0, Math.min(255, ((num >> 8) & 0x00FF) + percent));
        const b = Math.max(0, Math.min(255, (num & 0x0000FF) + percent));
        return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')}`;
    }

    function resolveCardLogoUrl(selectedLogoId) {
        if (selectedLogoId) {
            const selectedLogo = state.shopLogos?.find(l => l.id === selectedLogoId);
            if (selectedLogo?.image) return selectedLogo.image;
        }
        return state.shop?.shopLogo || '';
    }

    function safeFilenamePart(value) {
        const cleaned = String(value || '')
            .trim()
            .replace(/[^a-z0-9._-]+/gi, '-')
            .replace(/-+/g, '-')
            .replace(/^[-.]+|[-.]+$/g, '')
            .slice(0, 40);
        return cleaned || 'card';
    }

    async function generateDebtCardPng(payload, options = {}) {
        const scale = Number(options.scale) || 3;
        const width = 1200;
        const hasMessage = !!(payload.customMessage && String(payload.customMessage).trim());
        const height = hasMessage ? 820 : 680;
        const margin = 72;
        const radius = 28;

        const style = payload.cardStyle || 'classic';
        const accent = payload.cardColor || '#22c55e';
        const accentStrong = adjustColor(accent, -30);
        const accentDeep = adjustColor(accent, -55);

        const canvas = document.createElement('canvas');
        canvas.width = width * scale;
        canvas.height = height * scale;
        const ctx = canvas.getContext('2d');
        ctx.scale(scale, scale);

        const roundRect = (x, y, w, h, r) => {
            const rr = Math.min(r, w / 2, h / 2);
            ctx.beginPath();
            ctx.moveTo(x + rr, y);
            ctx.arcTo(x + w, y, x + w, y + h, rr);
            ctx.arcTo(x + w, y + h, x, y + h, rr);
            ctx.arcTo(x, y + h, x, y, rr);
            ctx.arcTo(x, y, x + w, y, rr);
            ctx.closePath();
        };

        const fillRoundRect = (x, y, w, h, r, fill, stroke) => {
            roundRect(x, y, w, h, r);
            if (fill) {
                ctx.fillStyle = fill;
                ctx.fill();
            }
            if (stroke) {
                ctx.strokeStyle = stroke;
                ctx.lineWidth = 2;
                ctx.stroke();
            }
        };

        const drawText = (text, x, y, opts = {}) => {
            const {
                size = 18,
                weight = 600,
                color = '#ffffff',
                align = 'left',
                baseline = 'alphabetic',
                family = 'Space Grotesk, ui-sans-serif, system-ui'
            } = opts;
            ctx.fillStyle = color;
            ctx.textAlign = align;
            ctx.textBaseline = baseline;
            ctx.font = `${weight} ${size}px ${family}`;
            ctx.fillText(String(text ?? ''), x, y);
        };

        const wrapText = (text, x, y, maxWidth, lineHeight, opts = {}) => {
            const words = String(text ?? '').split(/\s+/).filter(Boolean);
            let line = '';
            let cy = y;
            words.forEach((word, idx) => {
                const testLine = line ? `${line} ${word}` : word;
                ctx.font = `${opts.weight || 500} ${opts.size || 16}px ${opts.family || 'Space Grotesk, ui-sans-serif, system-ui'}`;
                if (ctx.measureText(testLine).width > maxWidth && line) {
                    drawText(line, x, cy, opts);
                    line = word;
                    cy += lineHeight;
                } else {
                    line = testLine;
                }
                if (idx === words.length - 1 && line) {
                    drawText(line, x, cy, opts);
                }
            });
            return cy;
        };

        // Background
        if (style === 'minimal') {
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(0, 0, width, height);
            fillRoundRect(24, 24, width - 48, height - 48, radius, null, 'rgba(15, 23, 42, 0.10)');
        } else {
            const grad = ctx.createLinearGradient(0, 0, width, height);
            grad.addColorStop(0, accent);
            grad.addColorStop(1, style === 'modern' ? accentStrong : adjustColor(accent, -20));
            ctx.fillStyle = grad;
            ctx.fillRect(0, 0, width, height);

            // Subtle atmosphere
            const glow = ctx.createRadialGradient(width * 0.75, height * 0.25, 40, width * 0.75, height * 0.25, 520);
            glow.addColorStop(0, 'rgba(255,255,255,0.20)');
            glow.addColorStop(1, 'rgba(255,255,255,0)');
            ctx.fillStyle = glow;
            ctx.fillRect(0, 0, width, height);
        }

        const textColor = style === 'minimal' ? '#0f172a' : '#ffffff';
        const textSoft = style === 'minimal' ? 'rgba(15, 23, 42, 0.70)' : 'rgba(255,255,255,0.80)';
        const pillBg = style === 'minimal' ? 'rgba(15, 23, 42, 0.06)' : 'rgba(255,255,255,0.18)';

        // Header: logo + shop name
        const logoUrl = resolveCardLogoUrl(payload.selectedLogoId);
        const logoBox = 68;
        const logoX = margin;
        const logoY = margin - 6;
        if (logoUrl) {
            try {
                const img = await loadImage(logoUrl);
                const iw = img.naturalWidth || img.width || 1;
                const ih = img.naturalHeight || img.height || 1;
                const ratio = Math.min(logoBox / iw, logoBox / ih);
                const w = Math.max(1, Math.round(iw * ratio));
                const h = Math.max(1, Math.round(ih * ratio));
                fillRoundRect(logoX, logoY, logoBox, logoBox, 18, style === 'minimal' ? '#ffffff' : 'rgba(255,255,255,0.16)', style === 'minimal' ? 'rgba(15, 23, 42, 0.10)' : 'rgba(255,255,255,0.22)');
                ctx.save();
                roundRect(logoX, logoY, logoBox, logoBox, 18);
                ctx.clip();
                ctx.drawImage(img, logoX + (logoBox - w) / 2, logoY + (logoBox - h) / 2, w, h);
                ctx.restore();
            } catch (err) {
                console.warn('Debt card logo load failed', err);
            }
        } else {
            fillRoundRect(logoX, logoY, logoBox, logoBox, 18, style === 'minimal' ? '#f1f5f9' : 'rgba(255,255,255,0.18)');
            drawText('🏪', logoX + logoBox / 2, logoY + logoBox / 2 + 8, { size: 32, weight: 700, align: 'center', baseline: 'middle', color: textColor });
        }

        const shopName = payload.shopName || state.shop?.shopName || 'Your Shop';
        drawText(shopName, logoX + logoBox + 18, logoY + 28, { size: 22, weight: 800, color: textColor, baseline: 'alphabetic' });
        drawText(translate('ai.reminderTagline') || 'Please settle the balance by the due date.', logoX + logoBox + 18, logoY + 54, { size: 13, weight: 600, color: textSoft });

        // Badge (top-right)
        const badgeText = (translate('ai.reminderBadge') || 'Payment Reminder').toUpperCase();
        ctx.font = `800 12px Space Grotesk, ui-sans-serif, system-ui`;
        const badgePadX = 14;
        const badgePadY = 10;
        const badgeW = ctx.measureText(badgeText).width + badgePadX * 2;
        const badgeH = 32;
        const badgeX = width - margin - badgeW;
        const badgeY = margin - 2;
        const badgeFill = style === 'minimal' ? accent : pillBg;
        const badgeTextColor = style === 'minimal' ? '#ffffff' : textColor;
        fillRoundRect(badgeX, badgeY, badgeW, badgeH, 999, badgeFill, style === 'minimal' ? null : 'rgba(255,255,255,0.18)');
        drawText(badgeText, badgeX + badgeW / 2, badgeY + badgeH / 2 + 1, { size: 12, weight: 900, color: badgeTextColor, align: 'center', baseline: 'middle' });

        // Due pill (under badge)
        if (payload.dueDate) {
            const daysLeft = daysUntil(payload.dueDate);
            const dueLabel = Number.isFinite(daysLeft) ? formatDaysLeftText(daysLeft) : '';
            const dueDateFormatted = new Date(payload.dueDate).toLocaleDateString(state.language === 'bn' ? 'bn-BD' : 'en-US', { year: 'numeric', month: 'short', day: 'numeric' });
            const pillText = dueLabel ? `${dueLabel} • ${dueDateFormatted}` : dueDateFormatted;
            ctx.font = `700 12px Space Grotesk, ui-sans-serif, system-ui`;
            const pillW = Math.min(ctx.measureText(pillText).width + 22, 380);
            const pillH = 30;
            const pillX = width - margin - pillW;
            const pillY = badgeY + badgeH + 10;
            let pillColor = pillBg;
            let pillInk = textColor;
            if (Number.isFinite(daysLeft)) {
                if (daysLeft < 0) {
                    pillColor = style === 'minimal' ? 'rgba(239,68,68,0.14)' : 'rgba(239,68,68,0.25)';
                    pillInk = style === 'minimal' ? '#991b1b' : '#ffffff';
                } else if (daysLeft === 0) {
                    pillColor = style === 'minimal' ? 'rgba(59,130,246,0.14)' : 'rgba(59,130,246,0.25)';
                    pillInk = style === 'minimal' ? '#1e3a8a' : '#ffffff';
                } else if (daysLeft <= 2) {
                    pillColor = style === 'minimal' ? 'rgba(245,158,11,0.16)' : 'rgba(245,158,11,0.25)';
                    pillInk = style === 'minimal' ? '#92400e' : '#ffffff';
                }
            }
            fillRoundRect(pillX, pillY, pillW, pillH, 999, pillColor, style === 'minimal' ? 'rgba(15, 23, 42, 0.06)' : 'rgba(255,255,255,0.14)');
            drawText(pillText, pillX + pillW / 2, pillY + pillH / 2 + 1, { size: 12, weight: 800, color: pillInk, align: 'center', baseline: 'middle' });
        }

        // Main body
        const bodyTop = 230;
        const labelColor = style === 'minimal' ? 'rgba(15, 23, 42, 0.62)' : 'rgba(255,255,255,0.75)';
        drawText((translate('ai.customerName') || 'Customer').toUpperCase(), margin, bodyTop, { size: 12, weight: 900, color: labelColor });
        drawText(payload.customerName || '—', margin, bodyTop + 44, { size: 42, weight: 900, color: textColor });

        const amountText = payload.debtAmount > 0 ? formatCurrency(payload.debtAmount) : formatCurrency(0);
        drawText(amountText, margin, bodyTop + 118, { size: 54, weight: 900, color: style === 'minimal' ? accentDeep : '#ffffff' });

        // Details cards
        const detailsTop = bodyTop + 190;
        const detailCardH = 150;
        const detailGap = 18;
        const detailW = (width - margin * 2 - detailGap) / 2;

        const drawDetailCard = (x, title, value) => {
            const bg = style === 'minimal' ? '#f8fafc' : 'rgba(255,255,255,0.12)';
            const border = style === 'minimal' ? 'rgba(15, 23, 42, 0.10)' : 'rgba(255,255,255,0.18)';
            fillRoundRect(x, detailsTop, detailW, detailCardH, 22, bg, border);
            drawText(String(title).toUpperCase(), x + 18, detailsTop + 34, { size: 11, weight: 900, color: labelColor });
            wrapText(String(value || '—'), x + 18, detailsTop + 74, detailW - 36, 22, { size: 18, weight: 900, color: textColor });
        };

        const paymentMethod = payload.paymentMethod || '';
        const paymentNumber = payload.paymentNumber || '';
        drawDetailCard(margin, translate('ai.paymentMethod') || 'Payment Method', paymentMethod || '—');
        drawDetailCard(margin + detailW + detailGap, translate('ai.paymentNumber') || 'Payment', paymentNumber || '—');

        // Optional message
        if (hasMessage) {
            const msgTop = detailsTop + detailCardH + 22;
            const msgBg = style === 'minimal' ? 'rgba(15, 23, 42, 0.03)' : 'rgba(255,255,255,0.10)';
            const msgBorder = style === 'minimal' ? 'rgba(15, 23, 42, 0.08)' : 'rgba(255,255,255,0.16)';
            const msgH = Math.max(120, height - msgTop - margin);
            fillRoundRect(margin, msgTop, width - margin * 2, msgH, 22, msgBg, msgBorder);
            drawText((translate('ai.customMessage') || 'Message').toUpperCase(), margin + 18, msgTop + 30, { size: 11, weight: 900, color: labelColor });
            wrapText(`"${payload.customMessage}"`, margin + 18, msgTop + 68, width - margin * 2 - 36, 24, { size: 16, weight: 700, color: textSoft });
        }

        try {
            return canvas.toDataURL('image/png', 1.0);
        } catch (err) {
            console.warn('Debt card export failed', err);
            throw new Error('Could not generate PNG. If using an external logo, try removing it.');
        }
    }

    async function downloadDebtCardPng() {
        const debtCardForm = document.getElementById('debt-card-form');
        if (!debtCardForm) throw new Error('Debt card is not available.');
        const payload = buildDebtCardPayload(new FormData(debtCardForm));
        if (!payload.customerName || !(payload.debtAmount > 0)) {
            throw new Error('Please enter customer name and amount first.');
        }
        const pngUrl = await generateDebtCardPng(payload, { scale: 3 });
        const base = safeFilenamePart(payload.customerName);
        const filenameBase = base === 'card' ? `debt-card-${Date.now()}` : `${base}-debt-card`;
        const a = document.createElement('a');
        a.href = pngUrl;
        a.download = `${filenameBase}.png`;
        a.style.display = 'none';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
    }

    async function downloadDebtCardPdf() {
        const debtCardForm = document.getElementById('debt-card-form');
        if (!debtCardForm) throw new Error('Debt card is not available.');
        const payload = buildDebtCardPayload(new FormData(debtCardForm));
        if (!payload.customerName || !(payload.debtAmount > 0)) {
            throw new Error('Please enter customer name and amount first.');
        }
        const pngUrl = await generateDebtCardPng(payload, { scale: 3 });
        const base = safeFilenamePart(payload.customerName);
        const filenameBase = base === 'card' ? `debt-card-${Date.now()}` : `${base}-debt-card`;
        const jpeg = await pngDataUrlToJpegBytes(pngUrl, 0.92);
        const pdfBlob = buildSinglePagePdfFromJpeg(jpeg.bytes, jpeg.width, jpeg.height);
        const url = URL.createObjectURL(pdfBlob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${filenameBase}.pdf`;
        a.style.display = 'none';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }

    async function shareDebtCard() {
        const debtCardForm = document.getElementById('debt-card-form');
        if (!debtCardForm) throw new Error('Debt card is not available.');
        const payload = buildDebtCardPayload(new FormData(debtCardForm));
        if (!payload.customerName || !(payload.debtAmount > 0)) {
            throw new Error('Please enter customer name and amount first.');
        }

        const pngUrl = await generateDebtCardPng(payload, { scale: 3 });
        const base = safeFilenamePart(payload.customerName);
        const filenameBase = base === 'card' ? `debt-card-${Date.now()}` : `${base}-debt-card`;
        const file = await dataUrlToFile(pngUrl, `${filenameBase}.png`);
        const text = state.language === 'bn'
            ? `${payload.customerName} এর বাকি: ${formatCurrency(payload.debtAmount)}`
            : `Balance due for ${payload.customerName}: ${formatCurrency(payload.debtAmount)}`;

        if (navigator.canShare && navigator.canShare({ files: [file] })) {
            await navigator.share({ files: [file], text });
            return;
        }

        if (navigator.share) {
            await navigator.share({ text });
            return;
        }

        // Fallback: download the PNG
        const a = document.createElement('a');
        a.href = pngUrl;
        a.download = `${filenameBase}.png`;
        a.style.display = 'none';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
    }

    function escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    // Notes/Tasks Tab Switching
    function switchNotesTab(tab) {
        if (state.ui.activeNotesTab !== tab) playFeedback();
        state.ui.activeNotesTab = tab;
        saveState();

        document.querySelectorAll('.tab-btn-nt').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.tab === tab);
        });

        const tasksSec = document.getElementById('tasks-section');
        const notesSec = document.getElementById('notes-section');

        if (tasksSec) tasksSec.hidden = tab !== 'tasks';
        if (notesSec) notesSec.hidden = tab !== 'notes';

        if (tab === 'tasks') {
            renderHabitTracker();
        } else {
            renderNotesV3();
        }
        updateDockActiveState(state.ui.activePanel);
    }

    function setCustomersTab(tab, options = {}) {
        const nextTab = tab === 'debts' ? 'debts' : 'customers';
        state.ui.customersTab = nextTab;
        if (options.save !== false) {
            saveState();
        }

        selectors.customersTabs?.forEach(btn => {
            btn.classList.toggle('active', btn.dataset.customersTab === nextTab);
        });

        if (selectors.customersView) selectors.customersView.hidden = nextTab !== 'customers';
        if (selectors.debtsView) selectors.debtsView.hidden = nextTab !== 'debts';

        if (nextTab === 'customers') {
            renderCustomers();
        } else {
            renderDebtLedger();
        }
        updateDockActiveState(state.ui.activePanel);
    }

    function initDebtLedgerHandlers() {
        selectors.customersTabs?.forEach(btn => {
            btn.addEventListener('click', () => {
                setCustomersTab(btn.dataset.customersTab);
                playFeedback();
            });
        });

        selectors.debtSearch?.addEventListener('input', debounce(() => {
            state.ui.debtQuery = (selectors.debtSearch?.value || '').trim();
            saveState();
            renderDebtLedger();
        }, 150));

        document.querySelectorAll('.debt-filters .filter-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                document.querySelectorAll('.debt-filters .filter-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                state.ui.debtFilter = btn.dataset.filter || 'all';
                saveState();
                renderDebtLedger();
                playFeedback();
            });
        });

        selectors.aiDebtCalendarRefresh?.addEventListener('click', () => {
            renderAIDebtCalendar();
            playFeedback();
        });
    }

    // Logo Management
    async function handleLogoSubmit(event) {
        event.preventDefault();
        const formData = new FormData(event.target);
        const logoId = formData.get('logoId');
        const logoName = formData.get('logoName');
        const logoFile = formData.get('logoImage');

        if (!logoFile || !logoFile.size) {
            alert('Please select an image');
            return;
        }

        const logoDataUrl = await readFileAsDataUrl(logoFile);

        if (logoId) {
            const idx = state.shopLogos.findIndex(l => l.id === logoId);
            if (idx >= 0) {
                state.shopLogos[idx] = { ...state.shopLogos[idx], name: logoName, image: logoDataUrl };
            }
        } else {
            state.shopLogos.push({
                id: generateId('logo'),
                name: logoName,
                image: logoDataUrl,
                createdAt: Date.now()
            });
        }

        saveState();
        renderLogoList();
        populateCardLogoSelect();
        modals.logo?.close();
        playFeedback();
    }

    function renderLogoList() {
        if (!selectors.logoListContainer) return;

        if (!state.shopLogos || state.shopLogos.length === 0) {
            selectors.logoListContainer.innerHTML = '<p class="data-empty">No logos added yet.</p>';
            return;
        }

        selectors.logoListContainer.innerHTML = state.shopLogos.map(logo => `
            <div class="logo-item">
                <img src="${logo.image}" alt="${logo.name}">
                <button class="logo-item-remove" data-logo-id="${logo.id}">×</button>
            </div>
        `).join('');

        selectors.logoListContainer.querySelectorAll('.logo-item-remove').forEach(btn => {
            btn.addEventListener('click', () => {
                const logoId = btn.dataset.logoId;
                state.shopLogos = state.shopLogos.filter(l => l.id !== logoId);
                saveState();
                renderLogoList();
                playFeedback();
            });
        });
    }

    // Update form handlers
    forms.shopProfile?.addEventListener('submit', handleShopProfileSubmit);
    forms.bill?.addEventListener('submit', handleBillSubmit);
})();
