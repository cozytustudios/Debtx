'use strict';

// Single authoritative skip login function (defined as early as possible)
(function() {
    if (typeof window === 'undefined') return;
    
    window.skipLoginNow = function() {
        console.log('skipLoginNow triggered');

        // Persist auth to localStorage immediately
        try {
            const stored = JSON.parse(localStorage.getItem('debtx-data-v1') || '{}');
            stored.authenticated = true;
            stored.auth = { email: '', passwordHash: '', passcode: '' };
            localStorage.setItem('debtx-data-v1', JSON.stringify(stored));
        } catch (err) {
            console.error('skipLoginNow localStorage error', err);
        }

        // Update in-memory state if available
        if (typeof state !== 'undefined') {
            state.authenticated = true;
            state.auth = { email: '', passwordHash: '', passcode: '' };
        }

        // Hide login UI
        const loginScreen = document.getElementById('login-screen');
        if (loginScreen) {
            loginScreen.style.display = 'none';
            loginScreen.hidden = true;
            loginScreen.style.opacity = '0';
            loginScreen.style.visibility = 'hidden';
            loginScreen.style.pointerEvents = 'none';
        }

        // Show app shell
        const app = document.getElementById('app');
        if (app) {
            app.hidden = false;
            app.style.display = 'flex';
            app.style.opacity = '1';
            app.style.visibility = 'visible';
        }

        // Initialize the app if available, otherwise reload as fallback
        if (typeof window.initializeApp === 'function') {
            try {
                window.initializeApp();
            } catch (err) {
                console.error('initializeApp failed after skipLoginNow', err);
                setTimeout(() => window.location.reload(), 300);
            }
        } else {
            setTimeout(() => window.location.reload(), 300);
        }
    };

    // Ensure button gets a click handler as soon as possible
    const bindSkipBtn = () => {
        const btn = document.getElementById('skip-login-btn');
        if (!btn) return;
        const handler = (e) => {
            if (e) {
                e.preventDefault();
                e.stopPropagation();
                e.stopImmediatePropagation?.();
            }
            window.skipLoginNow();
            return false;
        };
        btn.onclick = handler;
        btn.addEventListener('click', handler, true);
        btn.style.pointerEvents = 'auto';
        btn.style.cursor = 'pointer';
        btn.style.zIndex = '10001';
    };

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', bindSkipBtn);
    } else {
        bindSkipBtn();
    }

    // If a pending skip was queued from the inline script, run it now
    if (window.__pendingSkipLogin) {
        window.__pendingSkipLogin = false;
        window.skipLoginNow();
    }
})();

(function () {
    const STORAGE_KEY = 'debtx-data-v1';
    const LS_VERSION = 1;

    const todayString = () => new Date().toISOString().slice(0, 10);

    const defaultState = () => ({
        version: LS_VERSION,
        language: 'bn',
        theme: 'light',
        notificationsEnabled: false,
        authenticated: false,
        auth: {
            email: '',
            passwordHash: '',
            passcode: ''
        },
        guideCompleted: false,
        subscription: {
            type: 'free',
            expiresAt: null,
            activatedAt: null,
            coupon: null
        },
        requireLogin: false,
        shop: {
            name: '',
            image: '',
            phone: '',
            bank: ''
        },
        customers: [],
        notes: [],
        tasks: [],
        expenses: [],
        ui: {
            selectedDate: todayString(),
            activePanel: 'customers',
            fontSize: 'medium'
        }
    });

    const translations = {
        en: {
            'nav.customers': 'Customers',
            'nav.notes': 'Notes',
            'nav.tasks': 'To-Do',
            'nav.ai': 'AI Buddy',
            'customers.title': 'Customers & Debts',
            'customers.subtitle': 'Track dues, payments, and reminders',
            'customers.addCustomer': '+ Add Customer',
            'customers.searchPlaceholder': 'Search by name or phone',
            'customers.empty': 'No customers yet. Add the first customer to begin.',
            'customers.emptySearch': 'No matching customers. Try a different search.',
            'customers.card.balance': 'Balance',
            'customers.card.lastPayment': 'Last payment',
            'customers.card.dueDate': 'Due date',
            'customers.card.history': 'History',
            'customers.card.payment': 'Record Payment',
            'customers.card.debt': 'Add Debt',
            'customers.card.historyTitle': 'Activity',
            'customers.card.settled': 'Settled',
            'customers.card.onTrack': 'On track',
            'customers.card.dueSoon': 'Due soon',
            'customers.card.overdue': 'Overdue',
            'notes.title': 'Shop Notes',
            'notes.subtitle': 'Keep quick reminders in one place',
            'notes.addNote': '+ New Note',
            'notes.empty': 'No notes saved yet. Start writing your ideas.',
            'tasks.title': 'To-Do & Reminders',
            'tasks.subtitle': 'Watch payment dates and shop work',
            'tasks.addTask': '+ Add Task',
            'tasks.calendarHint': 'Tap a date to see upcoming payments and tasks.',
            'tasks.empty': 'No tasks scheduled. Add reminders to stay on track.',
            'tasks.card.done': 'Done',
            'tasks.card.due': 'Due',
            'tasks.card.debtType': 'Customer payment',
            'tasks.card.debtNote': 'Outstanding balance',
            'tasks.card.completed': 'Completed',
            'ai.subtitle': 'Your intelligent assistant for business insights',
            'ai.placeholder': 'Ask Optichain anything...',
            'ai.quick.findCustomer': 'Find Customer',
            'ai.quick.trustRatio': 'Trust Ratio',
            'ai.quick.planDay': 'Plan Day',
            'ai.quick.addTask': 'Add Task',
            'ai.quick.generateCard': 'Generate Card',
            'login.subtitle': 'Welcome back! Please sign in.',
            'login.email': 'Email',
            'login.passcode': 'Passcode',
            'login.emailLabel': 'Email',
            'login.passwordLabel': 'Password',
            'login.passcodeLabel': 'Passcode',
            'login.passcodeHint': 'Enter 4-6 digit passcode',
            'login.submit': 'Sign In',
            'login.setupPasscode': 'Setup Passcode',
            'guide.welcome.title': 'Welcome to Debtx!',
            'guide.welcome.text': 'Your digital khata for managing customer debts and payments.',
            'guide.customers.title': 'Manage Customers',
            'guide.customers.text': 'Add customers, track their debts, and record payments easily.',
            'guide.notes.title': 'Take Notes',
            'guide.notes.text': 'Keep quick reminders and important information in one place.',
            'guide.tasks.title': 'Track Tasks',
            'guide.tasks.text': 'Set reminders for payments and important shop activities.',
            'guide.ai.title': 'AI Assistant',
            'guide.ai.text': 'Use Optichain AI to get insights, generate cards, and more!',
            'guide.prev': 'Previous',
            'guide.next': 'Next',
            'guide.skip': 'Get Started',
            'card.paymentRequest': 'Payment Request',
            'card.amountDue': 'Amount Due',
            'card.selectCustomer': 'Select Customer',
            'card.message': 'Message (optional)',
            'card.paymentMethods': 'Payment Methods',
            'card.generate': 'Generate Card',
            'card.download': 'Download Image',
            'card.share': 'Share',
            'settings.shop.title': 'Shop Information',
            'settings.shop.name': 'Shop Name',
            'settings.shop.image': 'Shop Image/Logo',
            'settings.shop.phone': 'Phone Number',
            'settings.shop.bank': 'Bank Account (optional)',
            'settings.theme.zen': 'Zen',
            'settings.theme.cozy': 'Cozy',
            'settings.theme.ocean': 'Ocean',
            'settings.theme.forest': 'Forest',
            'settings.theme.sunset': 'Sunset',
            'settings.theme.lavender': 'Lavender',
            'customers.card.generateCard': 'Generate Card',
            'ai.response.findCustomer': 'Here are your customers:',
            'ai.response.trustRatio': 'Customer Trust Analysis:',
            'ai.response.planDay': 'Your day plan:',
            'ai.response.addTask': 'Task added successfully!',
            'ai.error': 'Sorry, I encountered an error. Please try again.',
            'settings.title': 'Settings',
            'settings.subtitle': 'Manage your preferences',
            'settings.language.title': 'Language',
            'settings.language.label': 'Select Language',
            'settings.notifications.title': 'Notifications',
            'settings.notifications.enable': 'Enable reminders',
            'settings.theme.title': 'Theme',
            'settings.theme.light': 'Light',
            'settings.theme.dark': 'Dark',
            'actions.cancel': 'Cancel',
            'actions.save': 'Save',
            'actions.delete': 'Delete',
            'modals.customer.title': 'Add Customer',
            'modals.customer.name': 'Customer Name',
            'modals.customer.phone': 'Phone Number (optional)',
            'modals.customer.repayDays': 'Repayment window (days)',
            'modals.customer.note': 'Note',
            'modals.debt.title': 'Record Debt',
            'modals.debt.amount': 'Debt Amount (৳)',
            'modals.debt.description': 'Description',
            'modals.debt.date': 'Date',
            'modals.payment.title': 'Record Payment',
            'modals.payment.amount': 'Payment Amount (৳)',
            'modals.payment.date': 'Date',
            'modals.payment.note': 'Note',
            'modals.note.title': 'New Note',
            'modals.note.titleLabel': 'Title',
            'modals.note.body': 'Note',
            'modals.task.title': 'Add Task',
            'modals.task.name': 'Task Name',
            'modals.task.type': 'Type',
            'modals.task.typePayment': 'Payment Follow-up',
            'modals.task.typeDelivery': 'Delivery',
            'modals.task.typePurchase': 'Stock Purchase',
            'modals.task.typeOther': 'Other',
            'modals.task.date': 'Due Date',
            'modals.task.note': 'Note',
            'footer.text': 'Debtx keeps your khata simple, clear, and close to you.',
            'notifications.enabled': 'Reminders on',
            'notifications.disabled': 'Reminders off',
            'notifications.permissionDenied': 'Notifications blocked. Allow them from browser settings.',
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
            'calendar.empty': 'No items for this day. Add a task or record a debt.'
        },
        bn: {
            'nav.customers': 'ক্রেতা',
            'nav.notes': 'নোট',
            'nav.tasks': 'করণীয়',
            'nav.ai': 'AI সহায়ক',
            'customers.title': 'ক্রেতা ও দেনা',
            'customers.subtitle': 'দেনা, পরিশোধ ও অনুস্মারক ট্র্যাক করুন',
            'customers.addCustomer': '+ নতুন ক্রেতা',
            'customers.searchPlaceholder': 'নাম বা ফোন দিয়ে খুঁজুন',
            'customers.empty': 'এখনও কোনো ক্রেতা নেই। প্রথম ক্রেতা যুক্ত করুন।',
            'customers.emptySearch': 'কোনো ক্রেতা পাওয়া যায়নি। অন্যভাবে খুঁজুন।',
            'customers.card.balance': 'বাকি টাকা',
            'customers.card.lastPayment': 'সর্বশেষ পেমেন্ট',
            'customers.card.dueDate': 'পরিশোধের তারিখ',
            'customers.card.history': 'ইতিহাস',
            'customers.card.payment': 'পেমেন্ট নিন',
            'customers.card.debt': 'দেনা লিখুন',
            'customers.card.historyTitle': 'লেনদেন',
            'customers.card.settled': 'পরিশোধিত',
            'customers.card.onTrack': 'সময়ের মধ্যে',
            'customers.card.dueSoon': 'শীঘ্রই বাকি',
            'customers.card.overdue': 'বাকি পড়েছে',
            'notes.title': 'দোকানের নোট',
            'notes.subtitle': 'দ্রুত নোট এক জায়গায় রাখুন',
            'notes.addNote': '+ নতুন নোট',
            'notes.empty': 'এখনও কোনো নোট নেই। লেখা শুরু করুন।',
            'tasks.title': 'করণীয় ও রিমাইন্ডার',
            'tasks.subtitle': 'পেমেন্ট তারিখ ও দোকানের কাজ দেখুন',
            'tasks.addTask': '+ নতুন কাজ',
            'tasks.calendarHint': 'দিনে ট্যাপ করুন, দেখুন পেমেন্ট ও কাজ।',
            'tasks.empty': 'এখনও কোনো কাজ নেই। রিমাইন্ডার যোগ করুন।',
            'tasks.card.done': 'শেষ',
            'tasks.card.due': 'শেষ করার তারিখ',
            'tasks.card.debtType': 'ক্রেতার পেমেন্ট',
            'tasks.card.debtNote': 'অবশিষ্ট টাকা',
            'tasks.card.completed': 'সম্পন্ন',
            'ai.subtitle': 'ব্যবসায়িক অন্তর্দৃষ্টির জন্য আপনার বুদ্ধিমান সহায়ক',
            'ai.placeholder': 'Optichain-কে কিছু জিজ্ঞাসা করুন...',
            'ai.quick.findCustomer': 'ক্রেতা খুঁজুন',
            'ai.quick.trustRatio': 'বিশ্বাস অনুপাত',
            'ai.quick.planDay': 'দিন পরিকল্পনা',
            'ai.quick.addTask': 'কাজ যোগ করুন',
            'ai.quick.generateCard': 'কার্ড তৈরি',
            'card.paymentRequest': 'পেমেন্ট অনুরোধ',
            'card.amountDue': 'বাকি টাকা',
            'card.selectCustomer': 'ক্রেতা নির্বাচন করুন',
            'card.message': 'বার্তা (ঐচ্ছিক)',
            'card.paymentMethods': 'পেমেন্ট পদ্ধতি',
            'card.generate': 'কার্ড তৈরি',
            'card.download': 'ছবি ডাউনলোড',
            'card.share': 'শেয়ার',
            'settings.shop.title': 'দোকানের তথ্য',
            'settings.shop.name': 'দোকানের নাম',
            'settings.shop.image': 'দোকানের ছবি/লোগো',
            'settings.shop.phone': 'ফোন নাম্বার',
            'settings.shop.bank': 'ব্যাংক অ্যাকাউন্ট (ঐচ্ছিক)',
            'settings.theme.zen': 'জেন',
            'settings.theme.cozy': 'কোজি',
            'settings.theme.ocean': 'সমুদ্র',
            'settings.theme.forest': 'বন',
            'settings.theme.sunset': 'সূর্যাস্ত',
            'settings.theme.lavender': 'ল্যাভেন্ডার',
            'customers.card.generateCard': 'কার্ড তৈরি',
            'login.subtitle': 'ফিরে আসার জন্য স্বাগতম! অনুগ্রহ করে সাইন ইন করুন।',
            'login.email': 'ইমেইল',
            'login.passcode': 'পাসকোড',
            'login.emailLabel': 'ইমেইল',
            'login.passwordLabel': 'পাসওয়ার্ড',
            'login.passcodeLabel': 'পাসকোড',
            'login.passcodeHint': '৪-৬ সংখ্যার পাসকোড দিন',
            'login.submit': 'সাইন ইন',
            'login.setupPasscode': 'পাসকোড সেটআপ',
            'guide.welcome.title': 'Debtx-এ স্বাগতম!',
            'guide.welcome.text': 'ক্রেতার দেনা ও পেমেন্ট ব্যবস্থাপনার জন্য আপনার ডিজিটাল খাতা।',
            'guide.customers.title': 'ক্রেতা পরিচালনা',
            'guide.customers.text': 'ক্রেতা যোগ করুন, তাদের দেনা ট্র্যাক করুন এবং সহজে পেমেন্ট রেকর্ড করুন।',
            'guide.notes.title': 'নোট নিন',
            'guide.notes.text': 'দ্রুত নোট এবং গুরুত্বপূর্ণ তথ্য এক জায়গায় রাখুন।',
            'guide.tasks.title': 'কাজ ট্র্যাক করুন',
            'guide.tasks.text': 'পেমেন্ট এবং গুরুত্বপূর্ণ দোকানের কাজের জন্য রিমাইন্ডার সেট করুন।',
            'guide.ai.title': 'AI সহায়ক',
            'guide.ai.text': 'Optichain AI ব্যবহার করে অন্তর্দৃষ্টি পান, কার্ড তৈরি করুন এবং আরও অনেক কিছু!',
            'guide.prev': 'পূর্ববর্তী',
            'guide.next': 'পরবর্তী',
            'guide.skip': 'শুরু করুন',
            'ai.response.findCustomer': 'আপনার ক্রেতারা:',
            'ai.response.trustRatio': 'ক্রেতা বিশ্বাস বিশ্লেষণ:',
            'ai.response.planDay': 'আপনার দিনের পরিকল্পনা:',
            'ai.response.addTask': 'কাজ সফলভাবে যোগ করা হয়েছে!',
            'ai.error': 'দুঃখিত, একটি ত্রুটি হয়েছে। আবার চেষ্টা করুন।',
            'settings.title': 'সেটিংস',
            'settings.subtitle': 'আপনার পছন্দসমূহ পরিচালনা করুন',
            'settings.language.title': 'ভাষা',
            'settings.language.label': 'ভাষা নির্বাচন করুন',
            'settings.notifications.title': 'নোটিফিকেশন',
            'settings.notifications.enable': 'রিমাইন্ডার চালু করুন',
            'settings.theme.title': 'থিম',
            'settings.theme.light': 'হালকা',
            'settings.theme.dark': 'অন্ধকার',
            'actions.cancel': 'বাতিল',
            'actions.save': 'সংরক্ষণ করুন',
            'actions.delete': 'মুছে ফেলুন',
            'modals.customer.title': 'ক্রেতা যোগ করুন',
            'modals.customer.name': 'ক্রেতার নাম',
            'modals.customer.phone': 'ফোন নাম্বার (ঐচ্ছিক)',
            'modals.customer.repayDays': 'পরিশোধের সময়সীমা (দিন)',
            'modals.customer.note': 'নোট',
            'modals.debt.title': 'দেনা লিখুন',
            'modals.debt.amount': 'দেনার পরিমাণ (৳)',
            'modals.debt.description': 'বিবরণ',
            'modals.debt.date': 'তারিখ',
            'modals.payment.title': 'পেমেন্ট নিন',
            'modals.payment.amount': 'পেমেন্টের পরিমাণ (৳)',
            'modals.payment.date': 'তারিখ',
            'modals.payment.note': 'নোট',
            'modals.note.title': 'নতুন নোট',
            'modals.note.titleLabel': 'শিরোনাম',
            'modals.note.body': 'নোট',
            'modals.task.title': 'কাজ যোগ করুন',
            'modals.task.name': 'কাজের নাম',
            'modals.task.type': 'ধরন',
            'modals.task.typePayment': 'পেমেন্ট ফলো-আপ',
            'modals.task.typeDelivery': 'ডেলিভারি',
            'modals.task.typePurchase': 'মালামাল কেনা',
            'modals.task.typeOther': 'অন্যান্য',
            'modals.task.date': 'শেষ তারিখ',
            'modals.task.note': 'নোট',
            'footer.text': 'ডেবটএক্স আপনার খাতা রাখে সহজ ও নির্ভরযোগ্য।',
            'notifications.enabled': 'রিমাইন্ডার চালু',
            'notifications.disabled': 'রিমাইন্ডার বন্ধ',
            'notifications.permissionDenied': 'ব্রাউজারের সেটিং থেকে নোটিফিকেশন চালু করুন।',
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
            'calendar.empty': 'এই দিনে কিছু নেই। কাজ যোগ করুন বা দেনা লিখুন।'
        }
    };

    const state = loadState();
    if (!state.expenses) state.expenses = [];
    if (typeof state.requireLogin !== 'boolean') state.requireLogin = false;

    const selectors = {
        nav: {
            customers: document.getElementById('nav-customers'),
            notes: document.getElementById('nav-notes'),
            tasks: document.getElementById('nav-tasks'),
            ai: document.getElementById('nav-ai'),
            bill: document.getElementById('nav-bill')
        },
        panels: {
            customers: document.getElementById('panel-customers'),
            notes: document.getElementById('panel-notes'),
            tasks: document.getElementById('panel-tasks'),
            ai: document.getElementById('panel-ai'),
            bill: document.getElementById('panel-bill'),
            settings: document.getElementById('panel-settings')
        },
        settingsToggle: document.getElementById('settings-toggle'),
        settingsLanguage: document.getElementById('settings-language'),
        settingsNotifications: document.getElementById('settings-notifications'),
        settingsShopName: document.getElementById('settings-shop-name'),
        settingsShopImage: document.getElementById('settings-shop-image'),
        settingsShopPhone: document.getElementById('settings-shop-phone'),
        settingsShopBank: document.getElementById('settings-shop-bank'),
        shopImagePreview: document.getElementById('shop-image-preview'),
        settingsLoginEmail: document.getElementById('settings-login-email'),
        settingsLoginPassword: document.getElementById('settings-login-password'),
        settingsLoginPasscode: document.getElementById('settings-login-passcode'),
        settingsLoginSaveBtn: document.getElementById('settings-login-save-btn'),
        settingsLoginClearBtn: document.getElementById('settings-login-clear-btn'),
        settingsLoginRequireToggle: document.getElementById('settings-login-require-toggle'),
        dataExportBtn: document.getElementById('data-export-btn'),
        dataImportBtn: document.getElementById('data-import-btn'),
        dataImportFile: document.getElementById('data-import-file'),
        downloadBillPngBtn: document.getElementById('download-bill-png-btn'),
        themeButtons: document.querySelectorAll('.theme-btn'),
        aiTabs: document.querySelectorAll('.ai-tab'),
        aiTabContents: document.querySelectorAll('.ai-tab-content'),
        calculatorDisplay: document.getElementById('calculator-display'),
        calculatorButtons: document.querySelectorAll('.calc-btn'),
        cardCustomerSelect: document.getElementById('card-customer-select'),
        cardMessageInput: document.getElementById('card-message-input'),
        cardPhoneInput: document.getElementById('card-phone-input'),
        cardBankInput: document.getElementById('card-bank-input'),
        cardGenerateBtn: document.getElementById('card-generate-btn'),
        cardDownloadBtn: document.getElementById('card-download-btn'),
        cardShareBtn: document.getElementById('card-share-btn'),
        customerList: document.getElementById('customer-list'),
        customersEmpty: document.getElementById('customers-empty'),
        customerSearch: document.getElementById('customer-search'),
        notesList: document.getElementById('notes-list'),
        notesEmpty: document.getElementById('notes-empty'),
        tasksList: document.getElementById('tasks-list'),
        tasksEmpty: document.getElementById('tasks-empty'),
        miniCalendar: document.getElementById('mini-calendar'),
        addCustomerBtn: document.getElementById('add-customer-btn'),
        addNoteBtn: document.getElementById('add-note-btn'),
        addTaskBtn: document.getElementById('add-task-btn'),
        aiMessages: document.getElementById('ai-messages'),
        aiInput: document.getElementById('ai-input'),
        aiSendBtn: document.getElementById('ai-send-btn'),
        aiQuickActions: document.querySelectorAll('.ai-quick-btn'),
        installAppBtn: document.getElementById('install-app-btn'),
        learnAppBtn: document.getElementById('learn-app-btn'),
        statCustomers: document.getElementById('stat-customers-count'),
        statNotes: document.getElementById('stat-notes-count'),
        statTasks: document.getElementById('stat-tasks-count'),
        aiInsightHighest: document.getElementById('insight-highest-debt'),
        aiInsightTasks: document.getElementById('insight-task-completion'),
        aiInsightTip: document.getElementById('insight-ai-tip'),
        expenseTotal: document.getElementById('expense-total'),
        expenseMonthTotal: document.getElementById('expense-month-total'),
        expenseList: document.getElementById('expense-list'),
        expenseEmpty: document.getElementById('expenses-empty'),
        expenseForm: document.getElementById('expense-form'),
        expenseTitle: document.getElementById('expense-title'),
        expenseAmount: document.getElementById('expense-amount'),
        expenseCategory: document.getElementById('expense-category'),
        expenseNote: document.getElementById('expense-note'),
        expenseExportBtn: document.getElementById('expense-export-btn')
    };

    let deferredInstallPrompt = null;

    const modals = {
        customer: document.getElementById('customer-modal'),
        debt: document.getElementById('debt-modal'),
        payment: document.getElementById('payment-modal'),
        note: document.getElementById('note-modal'),
        task: document.getElementById('task-modal')
    };

    const forms = {
        customer: document.getElementById('customer-form'),
        debt: document.getElementById('debt-form'),
        payment: document.getElementById('payment-form'),
        note: document.getElementById('note-form'),
        task: document.getElementById('task-form')
    };

    const templates = {
        customerCard: document.getElementById('customer-card-template'),
        noteCard: document.getElementById('note-card-template'),
        taskCard: document.getElementById('task-card-template')
    };

    // Ensure DOM is ready before initializing
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        // DOM already ready
        init();
    }

    function init() {
        try {
            // Login removed from entry flow; always show app
            state.authenticated = true;
            // Ensure a valid starting panel
            if (!state.ui || !state.ui.activePanel || !selectors.panels[state.ui.activePanel]) {
                state.ui.activePanel = 'customers';
            }
            saveState();
            showApp();
            initializeApp();
        } catch (error) {
            console.error('Init error:', error);
            // Retry after a short delay
            setTimeout(init, 100);
        }
    }

    function refreshSelectors() {
        // Re-query all selectors to ensure they're available
        const navCustomers = document.getElementById('nav-customers');
        const navNotes = document.getElementById('nav-notes');
        const navTasks = document.getElementById('nav-tasks');
        const navAi = document.getElementById('nav-ai');
        const navBill = document.getElementById('nav-bill');
        
        if (navCustomers) selectors.nav.customers = navCustomers;
        if (navNotes) selectors.nav.notes = navNotes;
        if (navTasks) selectors.nav.tasks = navTasks;
        if (navAi) selectors.nav.ai = navAi;
        if (navBill) selectors.nav.bill = navBill;
        
        // Refresh other critical selectors
        const addCustomerBtn = document.getElementById('add-customer-btn');
        const addNoteBtn = document.getElementById('add-note-btn');
        const addTaskBtn = document.getElementById('add-task-btn');
        const settingsToggle = document.getElementById('settings-toggle');
        
        if (addCustomerBtn) selectors.addCustomerBtn = addCustomerBtn;
        if (addNoteBtn) selectors.addNoteBtn = addNoteBtn;
        if (addTaskBtn) selectors.addTaskBtn = addTaskBtn;
        if (settingsToggle) selectors.settingsToggle = settingsToggle;
    }

    function ensureButtonsClickable() {
        // Force all buttons to be clickable via inline styles as backup
        const allButtons = document.querySelectorAll('button:not(:disabled):not([disabled])');
        allButtons.forEach(btn => {
            btn.style.pointerEvents = 'auto';
            btn.style.cursor = 'pointer';
            btn.style.userSelect = 'none';
            btn.style.webkitUserSelect = 'none';
            btn.style.touchAction = 'manipulation';
            // Ensure button is not hidden
            if (btn.style.display === 'none') {
                btn.style.display = '';
            }
            if (btn.hidden) {
                btn.hidden = false;
            }
        });
        
        // Also ensure clickable elements
        const clickableElements = document.querySelectorAll('.primary-btn, .secondary-btn, .nav-btn, .calc-btn, .filter-btn, .theme-btn, .ai-tab, .suggestion-chip');
        clickableElements.forEach(el => {
            el.style.pointerEvents = 'auto';
            el.style.cursor = 'pointer';
        });
    }

    function initializeApp() {
        try {
            // Refresh selectors to ensure they're available
            refreshSelectors();
            
            // Ensure theme is set to light by default if not set
            if (!state.theme || state.theme === '') {
                state.theme = 'light';
                saveState();
            }
            checkSubscriptionStatus();
            applyTheme(state.theme);
            attachNavHandlers();
            attachModalHandlers();
            attachFormHandlers();
            attachMiscHandlers();
            attachSettingsHandlers();
            attachExpenseHandlers();
            attachDataBackupHandlers();
            attachAIHandlers();
            registerServiceWorker();
            setupInstallPrompt();
            applyLanguage(state.language, { initial: true });
            renderAll();
            startReminderLoop();
            // Guide is disabled - always mark as completed
            state.guideCompleted = true;
            saveState();
            
            // Ensure all buttons are clickable
            ensureButtonsClickable();
            
            // Add global click handler for all buttons (event delegation as fallback)
            document.addEventListener('click', function(e) {
                const button = e.target.closest('button');
                if (!button) return;
                
                // Handle nav buttons
                if (button.classList.contains('nav-btn') && button.dataset.target) {
                    e.preventDefault();
                    e.stopPropagation();
                    setActivePanel(button.dataset.target);
                    return;
                }
                
                // Handle add customer button
                if (button.id === 'add-customer-btn') {
                    e.preventDefault();
                    e.stopPropagation();
                    if (forms.customer) {
                        forms.customer.reset();
                        setModalMode(forms.customer, 'create');
                        if (modals.customer) modals.customer.showModal();
                    }
                    return;
                }
                
                // Handle add note button
                if (button.id === 'add-note-btn') {
                    e.preventDefault();
                    e.stopPropagation();
                    if (forms.note) {
                        forms.note.reset();
                        if (modals.note) modals.note.showModal();
                    }
                    return;
                }
                
                // Handle add task button
                if (button.id === 'add-task-btn') {
                    e.preventDefault();
                    e.stopPropagation();
                    if (forms.task) {
                        forms.task.reset();
                        if (forms.task.elements.dueDate) {
                            forms.task.elements.dueDate.value = todayString();
                        }
                        if (modals.task) modals.task.showModal();
                    }
                    return;
                }
                
                // Handle settings toggle
                if (button.id === 'settings-toggle') {
                    e.preventDefault();
                    e.stopPropagation();
                    const settingsPanel = selectors.panels.settings;
                    if (settingsPanel) {
                        if (settingsPanel.classList.contains('active')) {
                            const prevPanel = state.ui.activePanel === 'settings' ? 'customers' : state.ui.activePanel;
                            setActivePanel(prevPanel);
                        } else {
                            setActivePanel('settings');
                        }
                    }
                    return;
                }
                
                // Handle skip login
                const target = e.target.closest('[data-skip-login="true"]');
                if (target && target.id === 'skip-login-btn') {
                    e.preventDefault();
                    e.stopPropagation();
                    state.authenticated = true;
                    state.auth = { email: '', passwordHash: '', passcode: '' };
                    saveState();
                    hideLoginAndShowApp();
                    return;
                }
                
                // Handle buttons with data-target
                if (button.dataset.target) {
                    e.preventDefault();
                    setActivePanel(button.dataset.target);
                    return;
                }
            }, true);
            
            // Retry attaching handlers after a short delay to catch any missed elements
            setTimeout(() => {
                refreshSelectors();
                attachNavHandlers();
                attachModalHandlers();
                attachMiscHandlers();
                ensureButtonsClickable();
            }, 100);
            
            // Also ensure buttons stay clickable after a longer delay (for dynamic content)
            setTimeout(() => {
                ensureButtonsClickable();
            }, 500);
        } catch (error) {
            console.error('InitializeApp error:', error);
            // Try to at least show the app even if some handlers fail
            try {
                refreshSelectors();
                attachNavHandlers();
                renderAll();
            } catch (e) {
                console.error('Critical error:', e);
            }
        }
    }
    
    // Expose initializeApp globally for skipLoginNow
    window.initializeApp = initializeApp;

    function checkAuth() {
        // Login flow removed; always consider authenticated
        state.authenticated = true;
    }

    function showLoginScreen() {
        const loginScreen = document.getElementById('login-screen');
        const app = document.getElementById('app');
        if (loginScreen) {
            loginScreen.hidden = false;
            loginScreen.style.display = 'flex';
            loginScreen.style.opacity = '0';
            loginScreen.style.pointerEvents = 'auto';
            loginScreen.style.zIndex = '10000';
            setTimeout(() => {
                loginScreen.style.opacity = '1';
            }, 10);
        }
        if (app) {
            app.hidden = true;
            app.style.opacity = '0';
        }
    }

    function showApp() {
        const loginScreen = document.getElementById('login-screen');
        const app = document.getElementById('app');
        
        // Hide login screen immediately
        if (loginScreen) {
            loginScreen.style.opacity = '0';
            loginScreen.style.pointerEvents = 'none';
            loginScreen.style.display = 'none';
            loginScreen.hidden = true;
            loginScreen.style.zIndex = '-1';
        }
        
        // Show app and ensure it's clickable
        if (app) {
            app.hidden = false;
            app.style.display = 'flex';
            app.style.opacity = '1';
            app.style.visibility = 'visible';
            app.style.pointerEvents = 'auto';
            app.style.zIndex = '1';
            app.style.transition = 'opacity 0.3s ease';
        }
        
        // Ensure all buttons are clickable
        setTimeout(() => {
            document.querySelectorAll('button').forEach(btn => {
                btn.style.pointerEvents = 'auto';
                btn.style.cursor = 'pointer';
            });
        }, 50);
    }

    function attachLoginHandlers() {
        const loginForm = document.getElementById('login-form');
        const loginTabs = document.querySelectorAll('.login-tab');
        const loginTabContents = document.querySelectorAll('.login-tab-content');
        const setupPasscodeBtn = document.getElementById('setup-passcode-btn');
        const skipLoginBtn = document.getElementById('skip-login-btn');
        
        console.log('Attaching login handlers...', {
            loginForm: !!loginForm,
            skipLoginBtn: !!skipLoginBtn,
            setupPasscodeBtn: !!setupPasscodeBtn
        });

        // Tab switching
        loginTabs.forEach(tab => {
            tab.addEventListener('click', (e) => {
                e.preventDefault();
                const loginType = tab.dataset.loginType;
                loginTabs.forEach(t => t.classList.remove('active'));
                loginTabContents.forEach(c => c.classList.remove('active'));
                tab.classList.add('active');
                const content = document.querySelector(`[data-content="${loginType}"]`);
                if (content) content.classList.add('active');
            });
        });

        // Form submission
        if (loginForm) {
            loginForm.addEventListener('submit', (e) => {
                e.preventDefault();
                e.stopImmediatePropagation();
                handleLogin(e);
                return false;
            }, true);
        }

        // Enter key support
        const emailInput = document.getElementById('login-email');
        const passwordInput = document.getElementById('login-password');
        const passcodeInput = document.getElementById('login-passcode');
        
        [emailInput, passwordInput, passcodeInput].forEach(input => {
            if (input) {
                input.addEventListener('keydown', (e) => {
                    if (e.key === 'Enter') {
                        e.preventDefault();
                        loginForm?.requestSubmit();
                    }
                });
            }
        });

        // Setup passcode
        if (setupPasscodeBtn) {
            setupPasscodeBtn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                setupPasscode();
            });
        }
        
        // Skip login button - Use global function
        if (skipLoginBtn) {
            console.log('Setting up skip login button...');
            
            // Use the global function
            skipLoginBtn.onclick = function(e) {
                e?.preventDefault();
                e?.stopPropagation();
                window.skipLoginNow();
                return false;
            };
            
            // Also add as event listener
            skipLoginBtn.addEventListener('click', function(e) {
                e.preventDefault();
                e.stopPropagation();
                window.skipLoginNow();
                return false;
            }, true);
            
            // Make sure it's clickable
            skipLoginBtn.style.pointerEvents = 'auto';
            skipLoginBtn.style.cursor = 'pointer';
            
            console.log('Skip button setup complete');
        } else {
            console.error('Skip login button NOT FOUND!');
        }
    }

    function handleLogin(e) {
        if (e) {
            e.preventDefault();
            e.stopPropagation();
        }
        
        try {
            const emailInput = document.getElementById('login-email');
            const passwordInput = document.getElementById('login-password');
            const passcodeInput = document.getElementById('login-passcode');
            const activeTab = document.querySelector('.login-tab.active');
            const loginType = activeTab?.dataset.loginType || 'email';

            if (loginType === 'email') {
                const email = emailInput?.value.trim() || '';
                const password = passwordInput?.value || '';
                
                if (!email || !password) {
                    alert(state.language === 'bn' ? 'ইমেইল এবং পাসওয়ার্ড প্রয়োজন' : 'Email and password required');
                    return false;
                }

                if (state.auth.email && state.auth.passwordHash) {
                    // Verify existing credentials
                    const hash = simpleHash(password);
                    if (email === state.auth.email && hash === state.auth.passwordHash) {
                        state.authenticated = true;
                        saveState();
                        hideLoginAndShowApp();
                        return true;
                    } else {
                        alert(state.language === 'bn' ? 'ভুল ইমেইল বা পাসওয়ার্ড' : 'Incorrect email or password');
                        return false;
                    }
                } else {
                    // First time - create account
                    state.auth.email = email;
                    state.auth.passwordHash = simpleHash(password);
                    state.authenticated = true;
                    saveState();
                    hideLoginAndShowApp();
                    return true;
                }
            } else {
                // Passcode login
                const passcode = passcodeInput?.value.trim() || '';
                
                if (!passcode || passcode.length < 4) {
                    alert(state.language === 'bn' ? 'অনুগ্রহ করে ৪-৬ সংখ্যার পাসকোড দিন' : 'Please enter 4-6 digit passcode');
                    return false;
                }

                if (state.auth.passcode) {
                    // Verify existing passcode
                    if (passcode === state.auth.passcode) {
                        state.authenticated = true;
                        saveState();
                        hideLoginAndShowApp();
                        return true;
                    } else {
                        alert(state.language === 'bn' ? 'ভুল পাসকোড' : 'Incorrect passcode');
                        return false;
                    }
                } else {
                    // First time - set up passcode
                    if (passcode.length >= 4 && passcode.length <= 6 && /^\d+$/.test(passcode)) {
                        state.auth.passcode = passcode;
                        state.authenticated = true;
                        saveState();
                        hideLoginAndShowApp();
                        return true;
                    } else {
                        alert(state.language === 'bn' ? 'অবৈধ পাসকোড। ৪-৬ সংখ্যা প্রয়োজন।' : 'Invalid passcode. 4-6 digits required.');
                        return false;
                    }
                }
            }
        } catch (error) {
            console.error('Login error:', error);
            alert(state.language === 'bn' ? 'লগইন করতে সমস্যা হয়েছে। আবার চেষ্টা করুন।' : 'Login error. Please try again.');
            return false;
        }
    }

    function hideLoginAndShowApp() {
        console.log('Hiding login and showing app...');
        
        const loginScreen = document.getElementById('login-screen');
        const app = document.getElementById('app');
        
        // Hide login immediately - multiple methods
        if (loginScreen) {
            loginScreen.style.display = 'none';
            loginScreen.hidden = true;
            loginScreen.style.opacity = '0';
            loginScreen.style.pointerEvents = 'none';
            loginScreen.style.visibility = 'hidden';
            loginScreen.style.zIndex = '-1';
        }
        
        // Show app - multiple methods
        if (app) {
            app.hidden = false;
            app.style.display = 'flex';
            app.style.opacity = '1';
            app.style.visibility = 'visible';
            app.style.pointerEvents = 'auto';
        }
        
        // Force state save
        state.authenticated = true;
        saveState();
        
        // Initialize app
        try {
            initializeApp();
        } catch (error) {
            console.error('Error initializing app:', error);
            // Retry after a short delay
            setTimeout(() => {
                initializeApp();
            }, 100);
        }
    }

    function setupPasscode() {
        const passcode = prompt(state.language === 'bn' ? '৪-৬ সংখ্যার পাসকোড দিন:' : 'Enter 4-6 digit passcode:');
        if (passcode && passcode.length >= 4 && passcode.length <= 6 && /^\d+$/.test(passcode)) {
            state.auth.passcode = passcode;
            saveState();
            alert(state.language === 'bn' ? 'পাসকোড সেটআপ সম্পন্ন। এখন পাসকোড দিয়ে লগইন করুন।' : 'Passcode setup complete. You can now login with passcode.');
            // Switch to passcode tab
            const passcodeTab = document.querySelector('[data-login-type="passcode"]');
            if (passcodeTab) {
                passcodeTab.click();
            }
        } else if (passcode !== null) {
            alert(state.language === 'bn' ? 'অবৈধ পাসকোড। ৪-৬ সংখ্যা প্রয়োজন।' : 'Invalid passcode. 4-6 digits required.');
        }
    }

    function simpleHash(str) {
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
            const char = str.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash;
        }
        return hash.toString();
    }

    function showGuide() {
        const guideOverlay = document.getElementById('guide-overlay');
        if (!guideOverlay) return;
        
        let currentSlide = 0;
        const slides = guideOverlay.querySelectorAll('.guide-slide');
        const totalSlides = slides.length;
        const dotsContainer = guideOverlay.querySelector('.guide-dots');
        const prevBtn = document.getElementById('guide-prev');
        const nextBtn = document.getElementById('guide-next');
        const skipBtn = document.getElementById('guide-skip');

        // Create dots
        dotsContainer.innerHTML = '';
        for (let i = 0; i < totalSlides; i++) {
            const dot = document.createElement('div');
            dot.className = 'guide-dot' + (i === 0 ? ' active' : '');
            dot.addEventListener('click', () => goToSlide(i));
            dotsContainer.appendChild(dot);
        }

        function goToSlide(index) {
            if (index < 0 || index >= totalSlides) return;
            
            const currentSlideEl = slides[currentSlide];
            const nextSlideEl = slides[index];
            
            // Animate out current slide
            if (currentSlideEl && currentSlide !== index) {
                currentSlideEl.style.transition = 'all 0.3s ease';
                currentSlideEl.style.opacity = '0';
                currentSlideEl.style.transform = 'scale(0.9)';
            }
            
            setTimeout(() => {
                currentSlide = index;
                slides.forEach((slide, i) => {
                    slide.classList.toggle('active', i === index);
                    if (i === index) {
                        slide.style.opacity = '0';
                        slide.style.transform = 'scale(0.9)';
                    }
                });
                dotsContainer.querySelectorAll('.guide-dot').forEach((dot, i) => {
                    dot.classList.toggle('active', i === index);
                });
                prevBtn.style.display = index === 0 ? 'none' : 'block';
                nextBtn.style.display = index === totalSlides - 1 ? 'none' : 'block';
                skipBtn.style.display = index === totalSlides - 1 ? 'block' : 'none';
                
                // Animate in next slide
                if (nextSlideEl) {
                    setTimeout(() => {
                        nextSlideEl.style.transition = 'all 0.4s cubic-bezier(0.34, 1.56, 0.64, 1)';
                        nextSlideEl.style.opacity = '1';
                        nextSlideEl.style.transform = 'scale(1)';
                    }, 50);
                }
            }, currentSlide !== index ? 300 : 0);
        }

        prevBtn?.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            goToSlide(currentSlide - 1);
        });
        
        nextBtn?.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            goToSlide(currentSlide + 1);
        });
        
        skipBtn?.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            state.guideCompleted = true;
            saveState();
            guideOverlay.style.animation = 'zoomOut 0.3s ease';
            guideOverlay.style.opacity = '0';
            setTimeout(() => {
                guideOverlay.hidden = true;
                guideOverlay.style.animation = '';
            }, 300);
        });

        guideOverlay.hidden = false;
        guideOverlay.style.opacity = '0';
        guideOverlay.style.animation = 'fadeIn 0.4s ease';
        setTimeout(() => {
            guideOverlay.style.opacity = '1';
        }, 10);
        goToSlide(0);
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
            parsed.customers = (parsed.customers || []).map(prepareCustomerRecord);
            parsed.tasks = (parsed.tasks || []).map(task => Object.assign({ reminderSent: false }, task));
            if (!parsed.theme || parsed.theme === '') {
                parsed.theme = 'light';
            }
            parsed.shop = Object.assign(defaultState().shop, parsed.shop || {});
            parsed.auth = Object.assign(defaultState().auth, parsed.auth || {});
            parsed.authenticated = parsed.authenticated !== undefined ? parsed.authenticated : false;
            parsed.subscription = Object.assign(defaultState().subscription, parsed.subscription || {});
            return Object.assign(defaultState(), parsed);
        } catch (error) {
            console.error('Failed to load state', error);
            return defaultState();
        }
    }

    function saveState() {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
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

        prepared.debts = (prepared.debts || []).map(debt => Object.assign({ paidAmount: 0, reminders: {} }, debt));
        prepared.payments = prepared.payments || [];
        prepared.history = prepared.history || [];
        return prepared;
    }

    function attachNavHandlers() {
        Object.entries(selectors.nav).forEach(([key, btn]) => {
            if (!btn) return;
            btn.addEventListener('click', () => {
                setActivePanel(key);
            });
        });
        setActivePanel(state.ui.activePanel);
    }

    function attachSettingsHandlers() {
        selectors.settingsToggle?.addEventListener('click', () => {
            const settingsPanel = selectors.panels.settings;
            if (settingsPanel) {
                if (settingsPanel.classList.contains('active')) {
                    // Return to previous panel or customers
                    const prevPanel = state.ui.activePanel === 'settings' ? 'customers' : state.ui.activePanel;
                    setActivePanel(prevPanel);
                } else {
                    setActivePanel('settings');
                }
            }
        });

        selectors.settingsLanguage?.addEventListener('change', (e) => {
            applyLanguage(e.target.value);
            saveState();
        });

        selectors.settingsNotifications?.addEventListener('change', (e) => {
            state.notificationsEnabled = e.target.checked;
            saveState();
            if (e.target.checked && 'Notification' in window && Notification.permission !== 'granted') {
                Notification.requestPermission();
            }
        });

        selectors.themeButtons?.forEach(btn => {
            btn.addEventListener('click', () => {
                const theme = btn.dataset.theme;
                applyTheme(theme);
                state.theme = theme;
                saveState();
                selectors.themeButtons.forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
            });
        });

        if (selectors.settingsLanguage) {
            selectors.settingsLanguage.value = state.language;
        }
        if (selectors.settingsNotifications) {
            selectors.settingsNotifications.checked = state.notificationsEnabled;
        }
        selectors.themeButtons?.forEach(btn => {
            if (btn.dataset.theme === state.theme) {
                btn.classList.add('active');
            }
        });

        // Shop settings
        if (selectors.settingsShopName) {
            selectors.settingsShopName.value = state.shop.name || '';
            selectors.settingsShopName.addEventListener('input', (e) => {
                state.shop.name = e.target.value;
                saveState();
            });
        }
        if (selectors.settingsShopPhone) {
            selectors.settingsShopPhone.value = state.shop.phone || '';
            selectors.settingsShopPhone.addEventListener('input', (e) => {
                state.shop.phone = e.target.value;
                saveState();
            });
        }
        if (selectors.settingsShopBank) {
            selectors.settingsShopBank.value = state.shop.bank || '';
            selectors.settingsShopBank.addEventListener('input', (e) => {
                state.shop.bank = e.target.value;
                saveState();
            });
        }
        if (selectors.settingsShopImage) {
            selectors.settingsShopImage.addEventListener('change', (e) => {
                const file = e.target.files[0];
                if (file) {
                    const reader = new FileReader();
                    reader.onload = (event) => {
                        state.shop.image = event.target.result;
                        saveState();
                        updateShopImagePreview();
                    };
                    reader.readAsDataURL(file);
                }
            });
        }
        updateShopImagePreview();
        
        // Subscription handlers
        document.getElementById('buy-pro-btn')?.addEventListener('click', () => {
            window.open('https://www.facebook.com/profile.php?id=61560074175677', '_blank');
        });
        
        document.getElementById('buy-max-btn')?.addEventListener('click', () => {
            window.open('https://www.facebook.com/profile.php?id=61560074175677', '_blank');
        });
        
        document.getElementById('apply-coupon-btn')?.addEventListener('click', () => {
            const couponInput = document.getElementById('subscription-coupon');
            const couponCode = couponInput?.value || '';
            if (applyCoupon(couponCode)) {
                const subType = state.subscription.type === 'pro' ? 'Pro' : 'Max';
                const duration = state.subscription.type === 'pro' ? '1 month' : '1 year';
                alert(state.language === 'bn' 
                    ? `কুপন প্রয়োগ করা হয়েছে! ${subType} প্রিমিয়াম সক্রিয় (${duration})।` 
                    : `Coupon applied! ${subType} premium activated (${duration}).`);
                couponInput.value = '';
            } else {
                alert(state.language === 'bn' ? 'অবৈধ কুপন কোড।' : 'Invalid coupon code.');
            }
        });
        
        document.getElementById('export-premium-btn')?.addEventListener('click', () => {
            if (!isPremium()) {
                alert(state.language === 'bn' ? 'প্রিমিয়াম প্রয়োজন।' : 'Premium required.');
                return;
            }
            const premiumData = {
                subscription: state.subscription,
                exportedAt: Date.now()
            };
            const blob = new Blob([JSON.stringify(premiumData, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = 'debtx-premium.json';
            a.click();
            URL.revokeObjectURL(url);
        });
        
        document.getElementById('import-premium-btn')?.addEventListener('click', () => {
            document.getElementById('import-premium-file')?.click();
        });
        
        document.getElementById('import-premium-file')?.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (!file) return;
            
            const reader = new FileReader();
            reader.onload = (event) => {
                try {
                    const premiumData = JSON.parse(event.target.result);
                    if (premiumData.subscription) {
                        state.subscription = premiumData.subscription;
                        saveState();
                        renderSubscriptionStatus();
                        alert(state.language === 'bn' ? 'প্রিমিয়াম সফলভাবে আমদানি করা হয়েছে!' : 'Premium imported successfully!');
                    } else {
                        alert(state.language === 'bn' ? 'অবৈধ ফাইল ফরম্যাট।' : 'Invalid file format.');
                    }
                } catch (error) {
                    alert(state.language === 'bn' ? 'ফাইল পড়তে ত্রুটি হয়েছে।' : 'Error reading file.');
                }
            };
            reader.readAsText(file);
        });
        
        renderSubscriptionStatus();
        
        // Font size controls
        const fontSizeButtons = document.querySelectorAll('.font-size-btn');
        fontSizeButtons.forEach(btn => {
            btn.addEventListener('click', () => {
                const size = btn.dataset.size;
                state.ui.fontSize = size;
                applyFontSize(size);
                saveState();
                fontSizeButtons.forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
            });
        });
        
        // Apply initial font size
        if (state.ui.fontSize) {
            applyFontSize(state.ui.fontSize);
            fontSizeButtons.forEach(btn => {
                if (btn.dataset.size === state.ui.fontSize) {
                    btn.classList.add('active');
                }
            });
        }
        
        // Monthly Wrapped
        document.getElementById('view-monthly-wrapped-btn')?.addEventListener('click', () => {
            showMonthlyWrapped();
        });
        
        document.getElementById('share-wrapped-btn')?.addEventListener('click', () => {
            shareMonthlyWrapped();
        });
    }
    
    function applyFontSize(size) {
        const root = document.documentElement;
        if (size === 'smaller') {
            root.style.setProperty('--base-font-size', '12px');
        } else if (size === 'small') {
            root.style.setProperty('--base-font-size', '14px');
        } else if (size === 'large') {
            root.style.setProperty('--base-font-size', '18px');
        } else {
            root.style.setProperty('--base-font-size', '16px');
        }
        // Apply to body
        document.body.style.fontSize = root.style.getPropertyValue('--base-font-size') || '16px';
    }
    
    function showMonthlyWrapped() {
        const modal = document.getElementById('monthly-wrapped-modal');
        const content = document.getElementById('monthly-wrapped-content');
        if (!modal || !content) return;
        
        const now = new Date();
        const currentMonth = now.getMonth();
        const currentYear = now.getFullYear();
        const startOfMonth = new Date(currentYear, currentMonth, 1).getTime();
        const endOfMonth = new Date(currentYear, currentMonth + 1, 0).getTime();
        
        // Calculate stats
        const monthlyDebts = state.customers.flatMap(c => 
            c.debts.filter(d => {
                const debtDate = new Date(d.date).getTime();
                return debtDate >= startOfMonth && debtDate <= endOfMonth;
            })
        );
        
        const monthlyPayments = state.customers.flatMap(c => 
            c.payments.filter(p => {
                const payDate = new Date(p.date).getTime();
                return payDate >= startOfMonth && payDate <= endOfMonth;
            })
        );
        
        const totalDebts = monthlyDebts.reduce((sum, d) => sum + d.amount, 0);
        const totalPayments = monthlyPayments.reduce((sum, p) => sum + p.amount, 0);
        const newCustomers = state.customers.filter(c => {
            const created = new Date(c.createdAt).getTime();
            return created >= startOfMonth && created <= endOfMonth;
        }).length;
        
        const completedTasks = state.tasks.filter(t => {
            const taskDate = new Date(t.dueDate).getTime();
            return taskDate >= startOfMonth && taskDate <= endOfMonth && t.completed;
        }).length;
        
        const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 
                          'July', 'August', 'September', 'October', 'November', 'December'];
        
        content.innerHTML = `
            <div style="text-align: center; margin-bottom: 24px;">
                <h2 style="font-size: 2rem; margin: 0; background: var(--gradient-primary); -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text;">
                    ${monthNames[currentMonth]} ${currentYear}
                </h2>
                <p style="color: var(--text-soft); margin-top: 8px;">Your Monthly Summary</p>
            </div>
            <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 16px; margin-bottom: 24px;">
                <div style="background: var(--primary-soft); padding: 20px; border-radius: var(--radius-lg); text-align: center;">
                    <div style="font-size: 2.5rem; font-weight: 700; color: var(--primary-strong);">৳${totalDebts.toLocaleString()}</div>
                    <div style="color: var(--text-soft); margin-top: 8px;">Total Debts</div>
                </div>
                <div style="background: rgba(28, 139, 115, 0.1); padding: 20px; border-radius: var(--radius-lg); text-align: center;">
                    <div style="font-size: 2.5rem; font-weight: 700; color: var(--success);">৳${totalPayments.toLocaleString()}</div>
                    <div style="color: var(--text-soft); margin-top: 8px;">Total Payments</div>
                </div>
                <div style="background: rgba(242, 160, 61, 0.1); padding: 20px; border-radius: var(--radius-lg); text-align: center;">
                    <div style="font-size: 2.5rem; font-weight: 700; color: var(--accent);">${newCustomers}</div>
                    <div style="color: var(--text-soft); margin-top: 8px;">New Customers</div>
                </div>
                <div style="background: var(--primary-soft); padding: 20px; border-radius: var(--radius-lg); text-align: center;">
                    <div style="font-size: 2.5rem; font-weight: 700; color: var(--primary-strong);">${completedTasks}</div>
                    <div style="color: var(--text-soft); margin-top: 8px;">Completed Tasks</div>
                </div>
            </div>
            <div style="background: var(--surface-soft); padding: 20px; border-radius: var(--radius-lg);">
                <h3 style="margin: 0 0 12px;">Top Customers</h3>
                ${getTopCustomers(5).map((c, i) => `
                    <div style="display: flex; justify-content: space-between; padding: 12px 0; border-bottom: 1px solid var(--border);">
                        <span>${i + 1}. ${c.name}</span>
                        <strong>৳${c.balance.toLocaleString()}</strong>
                    </div>
                `).join('')}
            </div>
        `;
        
        modal.showModal();
    }
    
    function getTopCustomers(limit = 5) {
        return state.customers
            .map(c => ({
                name: c.name,
                balance: getCustomerBalance(c)
            }))
            .sort((a, b) => b.balance - a.balance)
            .slice(0, limit);
    }
    
    function shareMonthlyWrapped() {
        const content = document.getElementById('monthly-wrapped-content');
        if (!content) return;
        
        if (navigator.share) {
            navigator.share({
                title: 'My Monthly Wrapped - Debtx',
                text: content.innerText,
                url: window.location.href
            }).catch(() => {
                // Fallback to copy
                copyToClipboard(content.innerText);
            });
        } else {
            copyToClipboard(content.innerText);
            alert(state.language === 'bn' ? 'কপি করা হয়েছে!' : 'Copied to clipboard!');
        }
    }
    
    function copyToClipboard(text) {
        const textarea = document.createElement('textarea');
        textarea.value = text;
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
    }

    function attachAIHandlers() {
        // AI Tabs
        selectors.aiTabs?.forEach(tab => {
            tab.addEventListener('click', () => {
                const tabName = tab.dataset.tab;
                selectors.aiTabs.forEach(t => t.classList.remove('active'));
                selectors.aiTabContents.forEach(c => c.classList.remove('active'));
                tab.classList.add('active');
                document.querySelector(`[data-content="${tabName}"]`)?.classList.add('active');
                if (tabName === 'cards') {
                    renderCardGenerator();
                }
            });
        });

        // Chat - Textarea handling
        const aiInput = selectors.aiInput;
        const aiSendBtn = selectors.aiSendBtn;
        
        if (aiInput) {
            // Auto-resize textarea
            aiInput.addEventListener('input', () => {
                aiInput.style.height = 'auto';
                aiInput.style.height = Math.min(aiInput.scrollHeight, 200) + 'px';
                
                // Enable/disable send button
                if (aiSendBtn) {
                    aiSendBtn.disabled = !aiInput.value.trim();
                    aiSendBtn.classList.toggle('enabled', !!aiInput.value.trim());
                }
            });
            
            // Enter to send, Shift+Enter for new line
            aiInput.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    if (aiInput.value.trim()) {
                        handleAISend();
                    }
                }
            });
        }
        
        aiSendBtn?.addEventListener('click', handleAISend);

        // Quick suggestion chips
        document.querySelectorAll('.suggestion-chip').forEach(chip => {
            chip.addEventListener('click', () => {
                const action = chip.dataset.action;
                if (action === 'generate-card') {
                    if (!isPremium()) {
                        alert(state.language === 'bn' 
                            ? 'পেমেন্ট কার্ড তৈরি করতে প্রিমিয়াম প্রয়োজন। সেটিংস থেকে কিনুন।' 
                            : 'Premium required to generate payment cards. Purchase from Settings.');
                        setActivePanel('settings');
                        return;
                    }
                    setActivePanel('ai');
                    document.querySelector('[data-tab="cards"]')?.click();
                } else {
                    handleAIQuickAction(action);
                }
            });
        });

        // Calculator
        let calculatorState = { current: '0', previous: null, operation: null };
        selectors.calculatorButtons?.forEach(btn => {
            btn.addEventListener('click', () => {
                const value = btn.dataset.value;
                const action = btn.dataset.action;
                handleCalculatorInput(value, action, calculatorState);
            });
        });

        // Payment Card Generator
        selectors.cardGenerateBtn?.addEventListener('click', generatePaymentCard);
        selectors.cardDownloadBtn?.addEventListener('click', downloadPaymentCard);
        selectors.cardShareBtn?.addEventListener('click', sharePaymentCard);
        selectors.cardCustomerSelect?.addEventListener('change', updateCardPreview);
        selectors.cardMessageInput?.addEventListener('input', updateCardPreview);
        selectors.cardPhoneInput?.addEventListener('input', updateCardPreview);
        selectors.cardBankInput?.addEventListener('input', updateCardPreview);
    }

    function handleAISend() {
        const input = selectors.aiInput;
        const sendBtn = selectors.aiSendBtn;
        if (!input) return;
        
        const message = input.value.trim();
        if (!message) return;

        addAIMessage('user', message);
        input.value = '';
        input.style.height = 'auto';
        
        if (sendBtn) {
            sendBtn.disabled = true;
            sendBtn.classList.remove('enabled');
        }

        // Show loading indicator
        const loadingWrapper = document.createElement('div');
        loadingWrapper.className = 'ai-message-wrapper assistant loading';
        loadingWrapper.innerHTML = `
            <div class="ai-message-avatar">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path>
                </svg>
            </div>
            <div class="ai-message-content assistant-message">
                <div class="message-text">
                    <div class="typing-indicator">
                        <span></span><span></span><span></span>
                    </div>
                </div>
            </div>
        `;
        
        const messagesContainer = selectors.aiMessages;
        messagesContainer.appendChild(loadingWrapper);
        messagesContainer.scrollTop = messagesContainer.scrollHeight;

        // Process immediately for faster response
        setTimeout(() => {
            const response = processAIQuery(message);
            loadingWrapper.classList.remove('loading');
            const messageText = loadingWrapper.querySelector('.message-text');
            if (messageText) {
                messageText.innerHTML = formatMessageText(response);
            }
        }, 500);
    }

    function handleAIQuickAction(action) {
        let query = '';
        switch (action) {
            case 'find-customer':
                query = translate('ai.quick.findCustomer');
                break;
            case 'trust-ratio':
                query = translate('ai.quick.trustRatio');
                break;
            case 'plan-day':
                query = translate('ai.quick.planDay');
                break;
            case 'add-task':
                query = translate('ai.quick.addTask');
                break;
            case 'generate-card':
                setActivePanel('ai');
                document.querySelector('[data-tab="cards"]')?.click();
                return;
        }
        if (query) {
            selectors.aiInput.value = query;
            handleAISend();
        }
    }

    function addAIMessage(role, text) {
        const messagesContainer = selectors.aiMessages;
        if (!messagesContainer) return;

        // Remove welcome message if it exists
        const welcomeMsg = messagesContainer.querySelector('.ai-welcome-message');
        if (welcomeMsg) {
            welcomeMsg.style.opacity = '0';
            welcomeMsg.style.transform = 'scale(0.95)';
            setTimeout(() => welcomeMsg.remove(), 200);
        }

        // Hide quick suggestions after first message
        const quickSuggestions = document.getElementById('ai-quick-suggestions');
        if (quickSuggestions && messagesContainer.children.length === 0) {
            quickSuggestions.style.opacity = '0';
            setTimeout(() => quickSuggestions.style.display = 'none', 300);
        }

        const messageWrapper = document.createElement('div');
        messageWrapper.className = `ai-message-wrapper ${role}`;
        
        if (role === 'user') {
            messageWrapper.innerHTML = `
                <div class="ai-message-content user-message">
                    <div class="message-text">${escapeHtml(text)}</div>
                </div>
            `;
        } else {
            messageWrapper.innerHTML = `
                <div class="ai-message-avatar">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path>
                    </svg>
                </div>
                <div class="ai-message-content assistant-message">
                    <div class="message-text">${formatMessageText(text)}</div>
                </div>
            `;
        }
        
        // Add entrance animation
        messageWrapper.style.opacity = '0';
        messageWrapper.style.transform = role === 'user' ? 'translateY(10px)' : 'translateY(10px)';
        
        messagesContainer.appendChild(messageWrapper);
        
        // Scroll to bottom
        setTimeout(() => {
            messagesContainer.scrollTop = messagesContainer.scrollHeight;
        }, 50);
        
        // Trigger animation
        requestAnimationFrame(() => {
            messageWrapper.style.transition = 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)';
            messageWrapper.style.opacity = '1';
            messageWrapper.style.transform = 'translateY(0)';
        });
        
        return messageWrapper;
    }

    function escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    function formatMessageText(text) {
        // Convert newlines to <br> and preserve formatting
        return escapeHtml(text).replace(/\n/g, '<br>');
    }

    function processAIQuery(query) {
        const lowerQuery = query.toLowerCase();
        const lang = state.language;

        if (lowerQuery.includes('find') || lowerQuery.includes('customer') || lowerQuery.includes('ক্রেতা')) {
            return generateFindCustomerResponse(lang);
        } else if (lowerQuery.includes('trust') || lowerQuery.includes('ratio') || lowerQuery.includes('বিশ্বাস')) {
            return generateTrustRatioResponse(lang);
        } else if (lowerQuery.includes('plan') || lowerQuery.includes('day') || lowerQuery.includes('পরিকল্পনা')) {
            return generatePlanDayResponse(lang);
        } else if (lowerQuery.includes('add') && (lowerQuery.includes('task') || lowerQuery.includes('কাজ'))) {
            return generateAddTaskResponse(lang);
        } else if (lowerQuery.includes('generate') && (lowerQuery.includes('card') || lowerQuery.includes('কার্ড'))) {
            return lang === 'bn' 
                ? 'কার্ড তৈরি করতে, AI ট্যাবে "Payment Cards" ট্যাবে যান এবং একটি ক্রেতা নির্বাচন করুন।'
                : 'To generate a card, go to the "Payment Cards" tab in the AI section and select a customer.';
        } else if (lowerQuery.includes('calc') || lowerQuery.includes('calculate') || lowerQuery.includes('calculator') || lowerQuery.includes('ক্যালকুলেটর')) {
            return lang === 'bn' 
                ? 'ক্যালকুলেটর ব্যবহার করতে, AI ট্যাবে "Calculator" ট্যাবে যান।'
                : 'To use the calculator, go to the "Calculator" tab in the AI section.';
        } else if (lowerQuery.includes('help') || lowerQuery.includes('সাহায্য')) {
            return lang === 'bn' 
                ? 'আমি Optichain, আপনার AI সহায়ক।\n\nআমি করতে পারি:\n• ক্রেতা খুঁজা\n• বিশ্বাস অনুপাত বিশ্লেষণ\n• দিনের পরিকল্পনা\n• কাজ যোগ করা\n• কার্ড তৈরি\n• হিসাব করা\n• ব্যবসায়িক পরামর্শ\n\nআমাকে যেকোনো প্রশ্ন করুন!'
                : 'I\'m Optichain, your AI assistant.\n\nI can help you with:\n• Finding customers\n• Analyzing trust ratios\n• Planning your day\n• Adding tasks\n• Generating payment cards\n• Calculations\n• Business insights\n\nAsk me anything!';
        } else if (lowerQuery.includes('summary') || lowerQuery.includes('সারাংশ')) {
            return generateBusinessSummary(lang);
        } else {
            return lang === 'bn' 
                ? 'আমি Optichain, আপনার AI সহায়ক। আমি আপনাকে ক্রেতা খুঁজতে, বিশ্বাস অনুপাত বিশ্লেষণ করতে, দিন পরিকল্পনা করতে, কাজ যোগ করতে, কার্ড তৈরি করতে, হিসাব করতে এবং ব্যবসায়িক পরামর্শ দিতে সাহায্য করতে পারি। "help" লিখে আরও জানুন।'
                : 'I\'m Optichain, your AI assistant. I can help you find customers, analyze trust ratios, plan your day, add tasks, generate cards, calculate, and provide business insights. Type "help" to learn more.';
        }
    }

    function generateFindCustomerResponse(lang) {
        if (state.customers.length === 0) {
            return lang === 'bn' 
                ? 'আপনার এখনও কোনো ক্রেতা নেই। প্রথমে একটি ক্রেতা যোগ করুন।'
                : 'You don\'t have any customers yet. Please add a customer first.';
        }

        let response = lang === 'bn' ? 'আপনার ক্রেতারা:\n\n' : 'Your customers:\n\n';
        state.customers.forEach((customer, index) => {
            const balance = getCustomerBalance(customer);
            response += `${index + 1}. ${customer.name}`;
            if (customer.phone) response += ` (${customer.phone})`;
            response += ` - Balance: ${formatCurrency(balance)}\n`;
        });
        return response;
    }

    function generateTrustRatioResponse(lang) {
        if (state.customers.length === 0) {
            return lang === 'bn' 
                ? 'বিশ্লেষণের জন্য কোনো ক্রেতা নেই।'
                : 'No customers to analyze.';
        }

        let response = lang === 'bn' ? 'ক্রেতা বিশ্বাস বিশ্লেষণ:\n\n' : 'Customer Trust Analysis:\n\n';
        
        state.customers.forEach(customer => {
            const totalDebts = customer.debts.reduce((sum, d) => sum + (d.amount || 0), 0);
            const totalPaid = customer.payments.reduce((sum, p) => sum + (p.amount || 0), 0);
            const balance = getCustomerBalance(customer);
            const paymentCount = customer.payments.length;
            const debtCount = customer.debts.length;
            
            let trustScore = 0;
            if (totalDebts > 0) {
                trustScore = Math.round((totalPaid / totalDebts) * 100);
            }
            if (paymentCount > debtCount) trustScore += 10;
            trustScore = Math.min(100, trustScore);

            const status = trustScore >= 80 ? (lang === 'bn' ? 'উচ্চ' : 'High') :
                          trustScore >= 50 ? (lang === 'bn' ? 'মধ্যম' : 'Medium') :
                          (lang === 'bn' ? 'নিম্ন' : 'Low');

            response += `${customer.name}: ${trustScore}% (${status})\n`;
            response += `  ${lang === 'bn' ? 'মোট দেনা' : 'Total Debt'}: ${formatCurrency(totalDebts)}\n`;
            response += `  ${lang === 'bn' ? 'মোট পরিশোধ' : 'Total Paid'}: ${formatCurrency(totalPaid)}\n`;
            response += `  ${lang === 'bn' ? 'বর্তমান বাকি' : 'Current Balance'}: ${formatCurrency(balance)}\n\n`;
        });

        return response;
    }

    function generatePlanDayResponse(lang) {
        const today = todayString();
        const todayTasks = state.tasks.filter(t => t.dueDate === today && !t.done);
        const overdueDebts = [];

        state.customers.forEach(customer => {
            customer.debts.forEach(debt => {
                if (getDebtOutstanding(debt) > 0 && debt.dueDate && new Date(debt.dueDate) < new Date(today)) {
                    overdueDebts.push({ customer: customer.name, amount: getDebtOutstanding(debt) });
                }
            });
        });

        let response = lang === 'bn' ? 'আপনার দিনের পরিকল্পনা:\n\n' : 'Your day plan:\n\n';

        if (overdueDebts.length > 0) {
            response += lang === 'bn' ? '⚠️ বাকি পড়েছে:\n' : '⚠️ Overdue:\n';
            overdueDebts.forEach(item => {
                response += `  • ${item.customer}: ${formatCurrency(item.amount)}\n`;
            });
            response += '\n';
        }

        if (todayTasks.length > 0) {
            response += lang === 'bn' ? '📋 আজকের কাজ:\n' : '📋 Today\'s Tasks:\n';
            todayTasks.forEach(task => {
                response += `  • ${task.name}\n`;
            });
            response += '\n';
        }

        if (overdueDebts.length === 0 && todayTasks.length === 0) {
            response += lang === 'bn' 
                ? 'আজকের জন্য কোনো জরুরি কাজ নেই। ভালো দিন!'
                : 'No urgent tasks for today. Have a great day!';
        }

        return response;
    }

    function generateAddTaskResponse(lang) {
        const today = todayString();
        const suggestedTasks = [];

        state.customers.forEach(customer => {
            const balance = getCustomerBalance(customer);
            if (balance > 0) {
                const dueInfo = getCustomerDueInfo(customer);
                if (dueInfo.nextDueDate) {
                    suggestedTasks.push({
                        name: lang === 'bn' 
                            ? `${customer.name}-এর কাছে পেমেন্ট নিন`
                            : `Collect payment from ${customer.name}`,
                        dueDate: dueInfo.nextDueDate,
                        type: 'payment'
                    });
                }

        // Login/Security settings (managed only from Settings)
        if (selectors.settingsLoginEmail) selectors.settingsLoginEmail.value = state.auth.email || '';
        if (selectors.settingsLoginPasscode) selectors.settingsLoginPasscode.value = state.auth.passcode || '';
        if (selectors.settingsLoginRequireToggle) selectors.settingsLoginRequireToggle.checked = state.requireLogin || false;

        selectors.settingsLoginSaveBtn?.addEventListener('click', () => {
            state.auth.email = selectors.settingsLoginEmail?.value || '';
            state.auth.passcode = selectors.settingsLoginPasscode?.value || '';
            const pwd = selectors.settingsLoginPassword?.value || '';
            state.auth.passwordHash = pwd ? simpleHash(pwd) : '';
            state.requireLogin = selectors.settingsLoginRequireToggle?.checked || false;
            state.authenticated = true; // stay logged in
            saveState();
            alert('Login info saved in settings. App stays open; login is optional.');
        });

        selectors.settingsLoginClearBtn?.addEventListener('click', () => {
            state.auth = { email: '', passwordHash: '', passcode: '' };
            state.requireLogin = false;
            state.authenticated = true;
            if (selectors.settingsLoginEmail) selectors.settingsLoginEmail.value = '';
            if (selectors.settingsLoginPassword) selectors.settingsLoginPassword.value = '';
            if (selectors.settingsLoginPasscode) selectors.settingsLoginPasscode.value = '';
            if (selectors.settingsLoginRequireToggle) selectors.settingsLoginRequireToggle.checked = false;
            saveState();
            alert('Login data cleared. App will stay unlocked.');
        });
            }
        });

        if (suggestedTasks.length > 0) {
            const task = suggestedTasks[0];
            const newTask = {
                id: generateId('task'),
                name: task.name,
                type: task.type,
                dueDate: task.dueDate,
                note: '',
                done: false,
                reminderSent: false,
                createdAt: Date.now()
            };
            state.tasks.push(newTask);
            saveState();
            renderTasks();
            return lang === 'bn' 
                ? `কাজ যোগ করা হয়েছে: ${task.name}`
                : `Task added: ${task.name}`;
        }

        return lang === 'bn' 
            ? 'কোনো সুপারিশকৃত কাজ নেই।'
            : 'No suggested tasks available.';
    }

    function attachModalHandlers() {
        document.querySelectorAll('[data-close]').forEach(btn => {
            btn.addEventListener('click', () => {
                const dialog = btn.closest('dialog');
                if (dialog) {
                    dialog.style.animation = 'zoomOut 0.2s ease';
                    setTimeout(() => {
                        dialog.close();
                        dialog.style.animation = '';
                    }, 200);
                }
            });
        });

        Object.values(modals).forEach(dialog => {
            if (!dialog) return;
            dialog.addEventListener('cancel', () => {
                dialog.style.animation = 'zoomOut 0.2s ease';
                setTimeout(() => {
                    dialog.close();
                    dialog.style.animation = '';
                }, 200);
            });
        });

        selectors.addCustomerBtn?.addEventListener('click', () => {
            forms.customer.reset();
            setModalMode(forms.customer, 'create');
            modals.customer.showModal();
            // Add modal entrance animation
            modals.customer.style.animation = 'zoomIn 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)';
        });

        selectors.addNoteBtn?.addEventListener('click', () => {
            forms.note.reset();
            modals.note.showModal();
            modals.note.style.animation = 'zoomIn 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)';
        });

        selectors.addTaskBtn?.addEventListener('click', () => {
            forms.task.reset();
            forms.task.elements.dueDate.value = todayString();
            modals.task.showModal();
            modals.task.style.animation = 'zoomIn 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)';
        });
    }

    function attachFormHandlers() {
        forms.customer?.addEventListener('submit', handleCustomerSubmit);
        forms.debt?.addEventListener('submit', handleDebtSubmit);
        forms.payment?.addEventListener('submit', handlePaymentSubmit);
        forms.note?.addEventListener('submit', handleNoteSubmit);
        forms.task?.addEventListener('submit', handleTaskSubmit);
    }

    function attachMiscHandlers() {
        selectors.customerSearch?.addEventListener('input', () => {
            renderCustomers();
        });
        
        // Notes search
        const notesSearchBtn = document.getElementById('notes-search-btn');
        const notesSearchBar = document.getElementById('notes-search-bar');
        const notesSearch = document.getElementById('notes-search');
        
        notesSearchBtn?.addEventListener('click', () => {
            if (notesSearchBar) {
                notesSearchBar.style.display = notesSearchBar.style.display === 'none' ? 'block' : 'none';
                if (notesSearchBar.style.display === 'block') {
                    notesSearch?.focus();
                }
            }
        });
        
        notesSearch?.addEventListener('input', () => {
            renderNotes();
        });

        selectors.learnAppBtn?.addEventListener('click', () => {
            // Show help in AI chat instead
            setActivePanel('ai');
            document.querySelector('[data-tab="chat"]')?.click();
            if (selectors.aiInput) {
                selectors.aiInput.value = 'help';
                handleAISend();
            }
        });
        
        // Tasks filter
        const tasksFilterBtn = document.getElementById('tasks-filter-btn');
        const tasksFilterBar = document.getElementById('tasks-filter-bar');
        const filterButtons = document.querySelectorAll('.filter-btn');
        
        tasksFilterBtn?.addEventListener('click', () => {
            if (tasksFilterBar) {
                tasksFilterBar.style.display = tasksFilterBar.style.display === 'none' ? 'flex' : 'none';
            }
        });
        
        filterButtons.forEach(btn => {
            btn.addEventListener('click', () => {
                const filter = btn.dataset.filter;
                filterButtons.forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                state.ui.taskFilter = filter;
                saveState();
                renderTasks();
            });
        });
        
        // Bill generation
        document.getElementById('generate-bill-btn')?.addEventListener('click', () => {
            showBillModal();
        });
        
        document.getElementById('quick-bill-btn')?.addEventListener('click', () => {
            showBillModal();
        });
        
        // Cancel premium
        document.getElementById('cancel-premium-btn')?.addEventListener('click', () => {
            if (confirm(state.language === 'bn' 
                ? 'আপনি কি নিশ্চিত যে আপনি প্রিমিয়াম বাতিল করতে চান?' 
                : 'Are you sure you want to cancel premium?')) {
                state.subscription = {
                    type: 'free',
                    expiresAt: null,
                    activatedAt: null,
                    coupon: null
                };
                saveState();
                renderSubscriptionStatus();
                alert(state.language === 'bn' ? 'প্রিমিয়াম বাতিল করা হয়েছে' : 'Premium cancelled');
            }
        });
        
        document.getElementById('add-bill-item-btn')?.addEventListener('click', () => {
            addBillItem();
        });
        
        document.getElementById('generate-bill-pdf-btn')?.addEventListener('click', () => {
            generateBillPDF();
        });
        
        // Update bill total on input
        const billItemsContainer = document.getElementById('bill-items-container');
        if (billItemsContainer) {
            billItemsContainer.addEventListener('input', (e) => {
                if (e.target.classList.contains('bill-item-qty') || e.target.classList.contains('bill-item-price')) {
                    updateBillTotal();
                }
            });
        }
        
        // Bill preview
        document.getElementById('preview-bill-btn')?.addEventListener('click', () => {
            previewBill();
        });
    }
    
    function previewBill() {
        const customerSelect = document.getElementById('bill-customer-select');
        const billDate = document.getElementById('bill-date');
        const items = document.querySelectorAll('.bill-item');
        
        if (!customerSelect || customerSelect.value === '') {
            alert(state.language === 'bn' ? 'অনুগ্রহ করে একজন ক্রেতা নির্বাচন করুন' : 'Please select a customer');
            return;
        }
        
        const customer = state.customers.find(c => c.id === customerSelect.value);
        if (!customer) return;
        
        const billItems = Array.from(items).map(item => ({
            name: item.querySelector('.bill-item-name')?.value || '',
            qty: parseFloat(item.querySelector('.bill-item-qty')?.value || 0),
            price: parseFloat(item.querySelector('.bill-item-price')?.value || 0)
        })).filter(item => item.name && item.qty > 0 && item.price > 0);
        
        if (billItems.length === 0) {
            alert(state.language === 'bn' ? 'অনুগ্রহ করে অন্তত একটি আইটেম যোগ করুন' : 'Please add at least one item');
            return;
        }
        
        const total = billItems.reduce((sum, item) => sum + (item.qty * item.price), 0);
        
        // Show preview in modal
        const previewHTML = generateBillHTML(customer, billItems, total, billDate?.value || todayString());
        const previewWindow = window.open('', '_blank', 'width=800,height=600');
        previewWindow.document.write(previewHTML);
        previewWindow.document.close();
    }
    
    function generateBillHTML(customer, billItems, total, billDate) {
        return `
            <!DOCTYPE html>
            <html>
            <head>
                <meta charset="UTF-8">
                <title>Bill - ${customer.name}</title>
                <style>
                    body { font-family: 'Inter', Arial, sans-serif; padding: 40px; background: #f5f5f5; }
                    .bill-container { background: white; padding: 40px; border-radius: 12px; box-shadow: 0 4px 20px rgba(0,0,0,0.1); max-width: 800px; margin: 0 auto; }
                    .header { text-align: center; margin-bottom: 40px; border-bottom: 2px solid #eee; padding-bottom: 20px; }
                    .header h1 { margin: 0; color: #1c8b73; font-size: 2rem; }
                    .customer-info { margin-bottom: 30px; }
                    .customer-info p { margin: 8px 0; }
                    table { width: 100%; border-collapse: collapse; margin: 30px 0; }
                    th, td { padding: 16px; text-align: left; border-bottom: 1px solid #eee; }
                    th { background-color: #f8f9fa; font-weight: 600; color: #333; }
                    .total-section { text-align: right; margin-top: 30px; padding-top: 20px; border-top: 2px solid #eee; }
                    .total-row { font-size: 1.5rem; font-weight: 700; color: #1c8b73; }
                </style>
            </head>
            <body>
                <div class="bill-container">
                    <div class="header">
                        <h1>${state.shop.name || 'Shop'}</h1>
                        <p style="color: #666; margin: 8px 0;">${state.shop.phone || ''}</p>
                    </div>
                    <div class="customer-info">
                        <p><strong>Bill To:</strong> ${customer.name}</p>
                        <p><strong>Date:</strong> ${billDate}</p>
                    </div>
                    <table>
                        <thead>
                            <tr>
                                <th>Item</th>
                                <th>Quantity</th>
                                <th>Price</th>
                                <th>Total</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${billItems.map(item => `
                                <tr>
                                    <td>${item.name}</td>
                                    <td>${item.qty}</td>
                                    <td>৳${item.price.toFixed(2)}</td>
                                    <td>৳${(item.qty * item.price).toFixed(2)}</td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                    <div class="total-section">
                        <div class="total-row">
                            <span>Total: ৳${total.toFixed(2)}</span>
                        </div>
                    </div>
                </div>
            </body>
            </html>
        `;
    }
    
    function showBillModal() {
        const modal = document.getElementById('bill-modal');
        const customerSelect = document.getElementById('bill-customer-select');
        const billDate = document.getElementById('bill-date');
        
        if (!modal || !customerSelect) return;
        
        // Populate customer select
        customerSelect.innerHTML = '<option value="">-- Select Customer --</option>';
        state.customers.forEach(customer => {
            const option = document.createElement('option');
            option.value = customer.id;
            option.textContent = customer.name;
            customerSelect.appendChild(option);
        });
        
        // Set today's date
        if (billDate) {
            billDate.value = todayString();
        }
        
        // Reset items
        const itemsContainer = document.getElementById('bill-items-container');
        if (itemsContainer) {
            itemsContainer.innerHTML = `
                <div class="bill-item">
                    <label>
                        <span>Product/Service</span>
                        <input type="text" class="bill-item-name" placeholder="Item name" required />
                    </label>
                    <label>
                        <span>Quantity</span>
                        <input type="number" class="bill-item-qty" min="1" value="1" required />
                    </label>
                    <label>
                        <span>Price (৳)</span>
                        <input type="number" class="bill-item-price" min="0" step="0.01" required />
                    </label>
                    <label>
                        <span>Total</span>
                        <input type="text" class="bill-item-total" readonly value="৳0" />
                    </label>
                </div>
            `;
            
            // Add event listeners to initial item
            const initialItem = itemsContainer.querySelector('.bill-item');
            const qtyInput = initialItem.querySelector('.bill-item-qty');
            const priceInput = initialItem.querySelector('.bill-item-price');
            [qtyInput, priceInput].forEach(input => {
                input.addEventListener('input', updateBillTotal);
            });
        }
        
        updateBillTotal();
        modal.showModal();
    }
    
    function addBillItem() {
        const itemsContainer = document.getElementById('bill-items-container');
        if (!itemsContainer) return;
        
        const newItem = document.createElement('div');
        newItem.className = 'bill-item';
        newItem.innerHTML = `
            <label>
                <span>Product/Service</span>
                <input type="text" class="bill-item-name" placeholder="Item name" required />
            </label>
            <label>
                <span>Quantity</span>
                <input type="number" class="bill-item-qty" min="1" value="1" required />
            </label>
            <label>
                <span>Price (৳)</span>
                <input type="number" class="bill-item-price" min="0" step="0.01" required />
            </label>
            <label>
                <span>Total</span>
                <input type="text" class="bill-item-total" readonly value="৳0" />
            </label>
            <button type="button" class="secondary-btn small-btn" onclick="this.parentElement.remove(); updateBillTotal();" title="Remove Item">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <line x1="18" y1="6" x2="6" y2="18"></line>
                    <line x1="6" y1="6" x2="18" y2="18"></line>
                </svg>
            </button>
        `;
        
        // Add event listeners for auto-calculation
        const qtyInput = newItem.querySelector('.bill-item-qty');
        const priceInput = newItem.querySelector('.bill-item-price');
        [qtyInput, priceInput].forEach(input => {
            input.addEventListener('input', updateBillTotal);
        });
        
        itemsContainer.appendChild(newItem);
    }
    
    function updateBillTotal() {
        const items = document.querySelectorAll('.bill-item');
        let subtotal = 0;
        
        items.forEach(item => {
            const qty = parseFloat(item.querySelector('.bill-item-qty')?.value || 0);
            const price = parseFloat(item.querySelector('.bill-item-price')?.value || 0);
            const itemTotal = qty * price;
            subtotal += itemTotal;
            
            // Update item total
            const itemTotalEl = item.querySelector('.bill-item-total');
            if (itemTotalEl) {
                itemTotalEl.value = `৳${itemTotal.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
            }
        });
        
        const tax = 0; // Can be made configurable
        const total = subtotal + tax;
        
        const subtotalEl = document.getElementById('bill-subtotal');
        const taxEl = document.getElementById('bill-tax');
        const totalEl = document.getElementById('bill-total');
        
        if (subtotalEl) {
            subtotalEl.textContent = `৳${subtotal.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
        }
        if (taxEl) {
            taxEl.textContent = `৳${tax.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
        }
        if (totalEl) {
            totalEl.textContent = `৳${total.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
        }
    }
    
    function generateBillPDF() {
        const customerSelect = document.getElementById('bill-customer-select');
        const billDate = document.getElementById('bill-date');
        const items = document.querySelectorAll('.bill-item');
        
        if (!customerSelect || customerSelect.value === '') {
            alert(state.language === 'bn' ? 'অনুগ্রহ করে একজন ক্রেতা নির্বাচন করুন' : 'Please select a customer');
            return;
        }
        
        const customer = state.customers.find(c => c.id === customerSelect.value);
        if (!customer) return;
        
        const billItems = Array.from(items).map(item => ({
            name: item.querySelector('.bill-item-name')?.value || '',
            qty: parseFloat(item.querySelector('.bill-item-qty')?.value || 0),
            price: parseFloat(item.querySelector('.bill-item-price')?.value || 0)
        })).filter(item => item.name && item.qty > 0 && item.price > 0);
        
        if (billItems.length === 0) {
            alert(state.language === 'bn' ? 'অনুগ্রহ করে অন্তত একটি আইটেম যোগ করুন' : 'Please add at least one item');
            return;
        }
        
        const total = billItems.reduce((sum, item) => sum + (item.qty * item.price), 0);
        
        // Generate bill HTML
        const billHTML = `
            <!DOCTYPE html>
            <html>
            <head>
                <meta charset="UTF-8">
                <title>Bill - ${customer.name}</title>
                <style>
                    body { font-family: Arial, sans-serif; padding: 40px; }
                    .header { text-align: center; margin-bottom: 30px; }
                    .shop-info { margin-bottom: 20px; }
                    .customer-info { margin-bottom: 20px; }
                    table { width: 100%; border-collapse: collapse; margin: 20px 0; }
                    th, td { padding: 12px; text-align: left; border-bottom: 1px solid #ddd; }
                    th { background-color: #f2f2f2; }
                    .total { text-align: right; font-size: 1.2em; font-weight: bold; margin-top: 20px; }
                </style>
            </head>
            <body>
                <div class="header">
                    <h1>${state.shop.name || 'Shop'}</h1>
                    <p>${state.shop.phone || ''}</p>
                </div>
                <div class="customer-info">
                    <p><strong>Bill To:</strong> ${customer.name}</p>
                    <p><strong>Date:</strong> ${billDate?.value || todayString()}</p>
                </div>
                <table>
                    <thead>
                        <tr>
                            <th>Item</th>
                            <th>Quantity</th>
                            <th>Price</th>
                            <th>Total</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${billItems.map(item => `
                            <tr>
                                <td>${item.name}</td>
                                <td>${item.qty}</td>
                                <td>৳${item.price.toFixed(2)}</td>
                                <td>৳${(item.qty * item.price).toFixed(2)}</td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
                <div class="total">
                    <p>Total: ৳${total.toFixed(2)}</p>
                </div>
            </body>
            </html>
        `;
        
        // Open in new window for printing
        const printWindow = window.open('', '_blank');
        printWindow.document.write(billHTML);
        printWindow.document.close();
        printWindow.focus();
        setTimeout(() => {
            printWindow.print();
        }, 250);
        
        // Close modal
        document.getElementById('bill-modal')?.close();
    }
    
    function showCustomizeCardModal(customer) {
        const modal = document.getElementById('customize-card-modal');
        const customerIdInput = document.getElementById('customize-customer-id');
        if (!modal || !customerIdInput) return;
        
        customerIdInput.value = customer.id;
        
        // Set up background options
        const bgOptions = document.querySelectorAll('.bg-option');
        bgOptions.forEach(btn => {
            btn.addEventListener('click', () => {
                bgOptions.forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                updateCardPreviewMini(customer, btn.dataset.bg);
            });
        });
        
        // Custom color picker
        const customColorInput = document.getElementById('custom-bg-color');
        customColorInput?.addEventListener('change', (e) => {
            updateCardPreviewMini(customer, null, e.target.value);
        });
        
        // Apply button
        document.getElementById('apply-card-customization-btn')?.addEventListener('click', () => {
            const selectedBg = document.querySelector('.bg-option.active')?.dataset.bg;
            const customColor = customColorInput?.value;
            applyCardCustomization(customer.id, selectedBg, customColor);
            modal.close();
        });
        
        // Download button
        document.getElementById('download-customized-card-btn')?.addEventListener('click', () => {
            downloadCustomerCard(customer, true);
        });
        
        updateCardPreviewMini(customer, 'gradient-primary');
        modal.showModal();
    }
    
    function updateCardPreviewMini(customer, bgType, customColor) {
        const preview = document.getElementById('card-preview-mini');
        if (!preview) return;
        
        let bgStyle = '';
        if (customColor) {
            bgStyle = `background: ${customColor};`;
        } else {
            switch(bgType) {
                case 'gradient-primary':
                    bgStyle = 'background: var(--gradient-primary);';
                    break;
                case 'gradient-accent':
                    bgStyle = 'background: var(--gradient-accent);';
                    break;
                case 'blue':
                    bgStyle = 'background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);';
                    break;
                case 'purple':
                    bgStyle = 'background: linear-gradient(135deg, #8b5cf6 0%, #ec4899 100%);';
                    break;
                case 'green':
                    bgStyle = 'background: linear-gradient(135deg, #10b981 0%, #059669 100%);';
                    break;
                case 'orange':
                    bgStyle = 'background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%);';
                    break;
                default:
                    bgStyle = 'background: var(--gradient-primary);';
            }
        }
        
        const balance = getCustomerBalance(customer);
        preview.innerHTML = `
            <div class="payment-card-mini" style="${bgStyle} color: #fff; padding: 20px; border-radius: 12px; margin-top: 12px;">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px;">
                    <h3 style="margin: 0; font-size: 1.2rem;">${customer.name}</h3>
                    ${state.shop.image ? `<img src="${state.shop.image}" style="width: 40px; height: 40px; border-radius: 8px;" />` : ''}
                </div>
                <div style="font-size: 2rem; font-weight: 700; margin: 16px 0;">
                    ৳${balance.toLocaleString()}
                </div>
                <p style="margin: 0; opacity: 0.9; font-size: 0.9rem;">Payment Request</p>
            </div>
        `;
    }
    
    function applyCardCustomization(customerId, bgType, customColor) {
        const customer = state.customers.find(c => c.id === customerId);
        if (!customer) return;
        
        customer.cardCustomization = {
            backgroundType: bgType,
            customColor: customColor
        };
        saveState();
    }
    
    function downloadCustomerCard(customer, useCustomization = false) {
        const balance = getCustomerBalance(customer);
        const customization = useCustomization ? customer.cardCustomization : null;
        const colors = resolveCardColors(customization);
        const message = state.language === 'bn'
            ? 'অনুগ্রহ করে আপনার বাকি পরিশোধ করুন।'
            : 'Please pay your outstanding balance.';
        const phone = state.shop.phone;
        const bank = state.shop.bank;

        createPaymentCardBlob({
            title: customer.name,
            amount: formatCurrency(balance),
            message,
            phone,
            bank,
            colors
        }).then(blob => {
            downloadBlobAsImage(blob, `payment-card-${customer.name}-${Date.now()}.png`);
        }).catch(() => {
            alert(state.language === 'bn' ? 'ডাউনলোড ব্যর্থ হয়েছে।' : 'Download failed.');
        });
    }

    function resolveCardColors(customization) {
        if (customization?.customColor) {
            return [customization.customColor, customization.customColor];
        }
        switch (customization?.backgroundType) {
            case 'gradient-accent':
                return ['#f2a03d', '#e68900'];
            case 'blue':
                return ['#667eea', '#764ba2'];
            case 'purple':
                return ['#8b5cf6', '#ec4899'];
            case 'green':
                return ['#10b981', '#059669'];
            case 'orange':
                return ['#f59e0b', '#d97706'];
            default:
                return getDefaultCardColors();
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

    function setupInstallPrompt() {
        const installBtn = selectors.installAppBtn;
        if (!installBtn) return;
        installBtn.setAttribute('disabled', 'true');
        window.addEventListener('beforeinstallprompt', (event) => {
            event.preventDefault();
            deferredInstallPrompt = event;
            installBtn.classList.add('ready');
            installBtn.removeAttribute('disabled');
        });
        installBtn.addEventListener('click', async () => {
            if (!deferredInstallPrompt) {
                alert(state.language === 'bn' 
                    ? 'ব্রাউজারের মেনু থেকে ইনস্টল করুন।' 
                    : 'Install via the browser menu.');
                return;
            }
            deferredInstallPrompt.prompt();
            const choice = await deferredInstallPrompt.userChoice;
            if (choice.outcome === 'accepted') {
                installBtn.textContent = state.language === 'bn' ? 'ইনস্টল সম্পন্ন' : 'Installed';
            }
            installBtn.classList.remove('ready');
            installBtn.setAttribute('disabled', 'true');
            deferredInstallPrompt = null;
        });
        window.addEventListener('appinstalled', () => {
            installBtn.classList.remove('ready');
            installBtn.setAttribute('disabled', 'true');
        });
    }

    function setActivePanel(panel) {
        // Fallback to customers if invalid
        if (!panel || !selectors.panels[panel]) {
            panel = 'customers';
        }
        state.ui.activePanel = panel;
        Object.entries(selectors.nav).forEach(([key, btn]) => {
            if (!btn) return;
            const wasActive = btn.classList.contains('active');
            btn.classList.toggle('active', key === panel);
            
            // Add bounce animation when switching
            if (!wasActive && key === panel) {
                btn.style.animation = 'bounce 0.5s ease';
                setTimeout(() => {
                    btn.style.animation = '';
                }, 500);
            }
        });
        Object.entries(selectors.panels).forEach(([key, panelEl]) => {
            if (!panelEl) return;
            const wasActive = panelEl.classList.contains('active');
            panelEl.classList.toggle('active', key === panel);
            
            // Add fade animation when switching panels
            if (wasActive && key !== panel) {
                panelEl.style.opacity = '0';
                panelEl.style.transform = 'translateX(20px)';
            } else if (!wasActive && key === panel) {
                panelEl.style.opacity = '0';
                panelEl.style.transform = 'translateX(-20px)';
                setTimeout(() => {
                    panelEl.style.transition = 'all 0.4s cubic-bezier(0.4, 0, 0.2, 1)';
                    panelEl.style.opacity = '1';
                    panelEl.style.transform = 'translateX(0)';
                }, 10);
            }
        });
        saveState();
    }

    function applyTheme(theme) {
        if (!theme) theme = 'light';
        document.documentElement.setAttribute('data-theme', theme);
    }

    function hasActiveSubscription() {
        if (!state.subscription || state.subscription.type === 'free') {
            return false;
        }
        if (state.subscription.expiresAt) {
            return Date.now() < state.subscription.expiresAt;
        }
        return true; // Legacy or coupon-based subscriptions
    }

    function isPremium() {
        return hasActiveSubscription();
    }

    function checkSubscriptionStatus() {
        if (state.subscription.expiresAt && Date.now() >= state.subscription.expiresAt) {
            state.subscription.type = 'free';
            state.subscription.expiresAt = null;
            saveState();
        }
    }

    function activateSubscription(type, durationMonths) {
        const now = Date.now();
        const expiresAt = durationMonths ? now + (durationMonths * 30 * 24 * 60 * 60 * 1000) : null;
        
        state.subscription = {
            type: type,
            expiresAt: expiresAt,
            activatedAt: now,
            coupon: state.subscription.coupon || null
        };
        saveState();
        renderSubscriptionStatus();
    }

    function applyCoupon(couponCode) {
        couponCode = couponCode.trim().toLowerCase();
        const now = Date.now();
        
        if (couponCode === 'terenceofclpro') {
            // Pro subscription - 1 month
            const oneMonth = 30 * 24 * 60 * 60 * 1000;
            state.subscription = {
                type: 'pro',
                expiresAt: now + oneMonth,
                activatedAt: now,
                coupon: couponCode
            };
            saveState();
            renderSubscriptionStatus();
            return true;
        } else if (couponCode === 'terencemax') {
            // Max subscription - 1 year
            const oneYear = 365 * 24 * 60 * 60 * 1000;
            state.subscription = {
                type: 'max',
                expiresAt: now + oneYear,
                activatedAt: now,
                coupon: couponCode
            };
            saveState();
            renderSubscriptionStatus();
            return true;
        } else if (couponCode === 'welovehayamis') {
            // Legacy coupon - still works
            const oneYear = 365 * 24 * 60 * 60 * 1000;
            state.subscription = {
                type: 'max',
                expiresAt: now + oneYear,
                activatedAt: now,
                coupon: couponCode
            };
            saveState();
            renderSubscriptionStatus();
            return true;
        }
        return false;
    }

    function renderSubscriptionStatus() {
        const statusEl = document.getElementById('subscription-status');
        if (!statusEl) return;
        
        checkSubscriptionStatus();
        
        if (hasActiveSubscription()) {
            const typeText = state.subscription.type === 'pro' ? 'Pro' : 'Max';
            const expiresText = state.subscription.expiresAt 
                ? new Date(state.subscription.expiresAt).toLocaleDateString()
                : 'Lifetime';
            statusEl.innerHTML = `
                <div style="padding: 16px; background: rgba(28, 139, 115, 0.1); border-radius: 12px; border: 2px solid var(--primary);">
                    <strong style="color: var(--primary);">✓ ${typeText} Active</strong>
                    ${state.subscription.expiresAt ? `<div style="font-size: 0.9rem; margin-top: 4px; color: var(--text-soft);">Expires: ${expiresText}</div>` : ''}
                </div>
            `;
        } else {
            statusEl.innerHTML = `
                <div style="padding: 16px; background: rgba(204, 59, 59, 0.1); border-radius: 12px; border: 2px solid var(--danger);">
                    <strong style="color: var(--danger);">Free Plan</strong>
                    <div style="font-size: 0.9rem; margin-top: 4px; color: var(--text-soft);">Limited to 10 customers, no payment cards</div>
                </div>
            `;
        }
    }

    function setModalMode(form, mode) {
        form.dataset.mode = mode;
    }

    function handleCustomerSubmit(event) {
        event.preventDefault();
        const form = event.target;
        
        // Check subscription limit
        if (!isPremium() && state.customers.length >= 10) {
            alert(state.language === 'bn' 
                ? 'ফ্রি প্ল্যানে সর্বোচ্চ ১০ জন ক্রেতা যোগ করা যায়। প্রিমিয়াম কিনুন।' 
                : 'Free plan limited to 10 customers. Upgrade to Premium.');
            return;
        }
        
        const data = new FormData(form);
        const customer = {
            id: generateId('cust'),
            name: data.get('name').trim(),
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
        modals.customer.style.animation = 'zoomOut 0.2s ease';
        setTimeout(() => {
            modals.customer.close();
            modals.customer.style.animation = '';
        }, 200);
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
        renderTasks();
        modals.debt.style.animation = 'zoomOut 0.2s ease';
        setTimeout(() => {
            modals.debt.close();
            modals.debt.style.animation = '';
        }, 200);
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
        renderTasks();
        modals.payment.style.animation = 'zoomOut 0.2s ease';
        setTimeout(() => {
            modals.payment.close();
            modals.payment.style.animation = '';
        }, 200);
    }

    function handleNoteSubmit(event) {
        event.preventDefault();
        const form = event.target;
        const data = new FormData(form);
        const note = {
            id: generateId('note'),
            title: data.get('title').trim(),
            body: (data.get('body') || '').trim(),
            createdAt: Date.now()
        };
        state.notes.unshift(note);
        saveState();
        renderNotes();
        modals.note.style.animation = 'zoomOut 0.2s ease';
        setTimeout(() => {
            modals.note.close();
            modals.note.style.animation = '';
        }, 200);
    }

    function handleTaskSubmit(event) {
        event.preventDefault();
        const form = event.target;
        const data = new FormData(form);
        const task = {
            id: generateId('task'),
            name: data.get('name').trim(),
            type: data.get('type'),
            dueDate: data.get('dueDate') || todayString(),
            note: (data.get('note') || '').trim(),
            done: false,
            reminderSent: false,
            createdAt: Date.now()
        };
        state.tasks.push(task);
        saveState();
        renderTasks();
        modals.task.style.animation = 'zoomOut 0.2s ease';
        setTimeout(() => {
            modals.task.close();
            modals.task.style.animation = '';
        }, 200);
    }

    function applyPaymentToDebts(customer, paymentAmount) {
        let remaining = paymentAmount;
        const outstandingDebts = customer.debts.sort((a, b) => new Date(a.date) - new Date(b.date));
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

    function attachExpenseHandlers() {
        selectors.expenseForm?.addEventListener('submit', (e) => {
            e.preventDefault();
            const title = (selectors.expenseTitle?.value || '').trim();
            const amount = parseFloat(selectors.expenseAmount?.value || '0');
            if (!title || isNaN(amount) || amount <= 0) {
                alert('Enter a valid title and amount.');
                return;
            }
            const expense = {
                id: crypto.randomUUID ? crypto.randomUUID() : String(Date.now()),
                title,
                amount,
                category: selectors.expenseCategory?.value || 'other',
                note: selectors.expenseNote?.value || '',
                createdAt: Date.now()
            };
            state.expenses.push(expense);
            saveState();
            renderExpenses();
            selectors.expenseForm.reset();
        });

        selectors.expenseExportBtn?.addEventListener('click', () => {
            exportExpensesCSV();
        });
    }

    function attachDataBackupHandlers() {
        selectors.dataExportBtn?.addEventListener('click', () => {
            const backup = { ...state, exportedAt: new Date().toISOString() };
            const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = 'debtx-backup.json';
            a.click();
            URL.revokeObjectURL(url);
        });

        selectors.dataImportBtn?.addEventListener('click', () => {
            selectors.dataImportFile?.click();
        });

        selectors.dataImportFile?.addEventListener('change', (e) => {
            const file = e.target.files?.[0];
            if (!file) return;
            const reader = new FileReader();
            reader.onload = (event) => {
                try {
                    const imported = JSON.parse(event.target.result);
                    Object.assign(state, imported);
                    if (!state.expenses) state.expenses = [];
                    saveState();
                    applyTheme(state.theme);
                    updateShopImagePreview();
                    renderSubscriptionStatus?.();
                    renderAll();
                    renderExpenses();
                    alert('Data imported successfully.');
                } catch (err) {
                    console.error('Import error', err);
                    alert('Invalid file or parse error.');
                }
            };
            reader.readAsText(file);
        });

        selectors.downloadBillPngBtn?.addEventListener('click', () => {
            if (typeof downloadPaymentCard === 'function') {
                downloadPaymentCard();
            } else {
                alert('Bill PNG generator is unavailable right now.');
            }
        });
    }

    function renderAll() {
        renderCustomers();
        renderNotes();
        renderTasks();
        renderExpenses();
        updateHeroStats();
        updateAIInsights();
        // Ensure all dynamically created buttons are clickable
        setTimeout(() => {
            ensureButtonsClickable();
        }, 50);
    }

    function updateHeroStats() {
        selectors.statCustomers?.textContent = state.customers.length.toString();
        selectors.statNotes?.textContent = state.notes.length.toString();
        const pending = state.tasks.filter(task => !task.done).length;
        selectors.statTasks?.textContent = pending.toString();
    }

    function updateAIInsights() {
        const highest = state.customers.reduce((max, customer) => Math.max(max, getCustomerBalance(customer)), 0);
        selectors.aiInsightHighest?.textContent = formatCurrency(highest);
        const total = state.tasks.length;
        const completed = state.tasks.filter(task => task.done).length;
        const completion = total ? Math.round((completed / total) * 100) : 0;
        selectors.aiInsightTasks?.textContent = `${completion}%`;
        let tip = '';
        if (state.customers.length) {
            const balance = formatCurrency(getCustomerBalance(state.customers[0]));
            tip = state.language === 'bn'
                ? `${state.customers[0].name}-এর কাছে ${balance} বাকি আছে।`
                : `${state.customers[0].name} owes ${balance}.`;
        } else if (state.notes.length) {
            tip = state.language === 'bn'
                ? 'একটি নোট পিন করুন আপনার পরবর্তী আইডিয়া ধরে রাখতে।'
                : 'Pin a note to capture your next insight.';
        } else {
            tip = state.language === 'bn'
                ? 'প্রথম ক্রেতাকে যোগ করে AI টিপস দেখুন।'
                : 'Add your first customer to get personalized AI tips.';
        }
        selectors.aiInsightTip?.textContent = tip;
    }

    function renderExpenses() {
        const { expenseList, expenseEmpty, expenseTotal, expenseMonthTotal } = selectors;
        if (!expenseList) return;
        const items = Array.isArray(state.expenses) ? [...state.expenses] : [];
        expenseList.innerHTML = '';

        if (!items.length) {
            expenseEmpty?.removeAttribute('hidden');
            if (expenseTotal) expenseTotal.textContent = formatCurrency(0);
            if (expenseMonthTotal) expenseMonthTotal.textContent = formatCurrency(0);
            return;
        }
        expenseEmpty?.setAttribute('hidden', 'hidden');

        const now = new Date();
        const month = now.getMonth();
        const year = now.getFullYear();
        const total = items.reduce((sum, e) => sum + (Number(e.amount) || 0), 0);
        const monthTotal = items
            .filter(e => {
                const d = new Date(e.createdAt || Date.now());
                return d.getMonth() === month && d.getFullYear() === year;
            })
            .reduce((sum, e) => sum + (Number(e.amount) || 0), 0);

        if (expenseTotal) expenseTotal.textContent = formatCurrency(total);
        if (expenseMonthTotal) expenseMonthTotal.textContent = formatCurrency(monthTotal);

        items.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
        items.forEach(e => {
            const item = document.createElement('div');
            item.className = 'expense-item';
            const date = formatDisplayDate ? formatDisplayDate(e.createdAt || Date.now()) : new Date(e.createdAt || Date.now()).toLocaleDateString();
            item.innerHTML = `
                <div class="meta">
                    <strong>${e.title || 'Expense'}</strong>
                    <div class="expense-category-pill">${e.category || 'other'}</div>
                    <small>${date}${e.note ? ' · ' + e.note : ''}</small>
                </div>
                <div class="expense-amount">${formatCurrency(Number(e.amount) || 0)}</div>
            `;
            expenseList.appendChild(item);
        });
    }

    function exportExpensesCSV() {
        const items = Array.isArray(state.expenses) ? state.expenses : [];
        if (!items.length) {
            alert('No expenses to export.');
            return;
        }
        const header = ['Title', 'Amount', 'Category', 'Note', 'Date'];
        const rows = items.map(e => [
            `"${(e.title || '').replace(/"/g, '""')}"`,
            Number(e.amount) || 0,
            e.category || '',
            `"${(e.note || '').replace(/"/g, '""')}"`,
            new Date(e.createdAt || Date.now()).toISOString()
        ].join(','));
        const csv = [header.join(','), ...rows].join('\n');
        const blob = new Blob([csv], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'debtx-expenses.csv';
        a.click();
        URL.revokeObjectURL(url);
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
                if (historySection.hidden) {
                    historySection.hidden = false;
                    historySection.style.opacity = '0';
                    historySection.style.transform = 'translateY(-10px)';
                    setTimeout(() => {
                        historySection.style.transition = 'all 0.3s ease';
                        historySection.style.opacity = '1';
                        historySection.style.transform = 'translateY(0)';
                    }, 10);
                } else {
                    historySection.style.transition = 'all 0.3s ease';
                    historySection.style.opacity = '0';
                    historySection.style.transform = 'translateY(-10px)';
                    setTimeout(() => {
                        historySection.hidden = true;
                    }, 300);
                }
            });

            card.querySelector('[data-action="payment"]').addEventListener('click', () => {
                preparePaymentModal(customer);
            });

            card.querySelector('[data-action="debt"]').addEventListener('click', () => {
                prepareDebtModal(customer);
            });

            const customizeCardBtn = card.querySelector('[data-action="customize-card"]');
            if (customizeCardBtn) {
                customizeCardBtn.addEventListener('click', () => {
                    showCustomizeCardModal(customer);
                });
            }
            
            const downloadCardBtn = card.querySelector('[data-action="download-card"]');
            if (downloadCardBtn) {
                downloadCardBtn.addEventListener('click', () => {
                    downloadCustomerCard(customer);
                });
            }
            
            const deleteCustomerBtn = card.querySelector('[data-action="delete-customer"]');
            if (deleteCustomerBtn) {
                deleteCustomerBtn.addEventListener('click', () => {
                    if (confirm(state.language === 'bn' 
                        ? `আপনি কি নিশ্চিত যে আপনি ${customer.name} কে মুছে ফেলতে চান?` 
                        : `Are you sure you want to delete ${customer.name}?`)) {
                        // Add delete animation
                        card.style.animation = 'zoomOut 0.3s ease';
                        card.style.opacity = '0';
                        setTimeout(() => {
                            state.customers = state.customers.filter(c => c.id !== customer.id);
                            saveState();
                            renderCustomers();
                        }, 300);
                    }
                });
            }

            customerList.appendChild(fragment);
            
            // Trigger entrance animation
            const customerCardEl = customerList.lastElementChild;
            if (customerCardEl) {
                customerCardEl.style.opacity = '0';
                customerCardEl.style.transform = 'translateY(20px)';
                setTimeout(() => {
                    customerCardEl.style.transition = 'all 0.5s cubic-bezier(0.4, 0, 0.2, 1)';
                    customerCardEl.style.opacity = '1';
                    customerCardEl.style.transform = 'translateY(0)';
                }, 10);
            }
        });
    }

    function renderNotes() {
        const { notesList, notesEmpty } = selectors;
        if (!notesList) return;

        notesList.innerHTML = '';
        
        // Get search query
        const searchQuery = document.getElementById('notes-search')?.value.toLowerCase() || '';
        let filteredNotes = state.notes;
        
        if (searchQuery) {
            filteredNotes = state.notes.filter(note => 
                (note.title || '').toLowerCase().includes(searchQuery) ||
                (note.body || '').toLowerCase().includes(searchQuery)
            );
        }
        
        if (!filteredNotes.length) {
            notesEmpty?.removeAttribute('hidden');
            return;
        }
        notesEmpty?.setAttribute('hidden', 'hidden');

        filteredNotes
            .sort((a, b) => b.createdAt - a.createdAt)
            .forEach(note => {
                const fragment = document.importNode(templates.noteCard.content, true);
                localizeFragment(fragment);
                const card = fragment.querySelector('.note-card');
                card.dataset.noteId = note.id;
                card.querySelector('.note-title').textContent = note.title || translate('notes.addNote');
                card.querySelector('.note-date').textContent = formatDateTime(note.createdAt);
                card.querySelector('.note-body').textContent = note.body;

                const deleteBtn = card.querySelector('[data-action="delete"]');
                deleteBtn.addEventListener('click', () => {
                    // Add delete animation
                    const noteCard = card;
                    noteCard.style.animation = 'zoomOut 0.3s ease';
                    noteCard.style.opacity = '0';
                    setTimeout(() => {
                        state.notes = state.notes.filter(item => item.id !== note.id);
                        saveState();
                        renderNotes();
                    }, 300);
                });

                notesList.appendChild(fragment);
                
                // Trigger entrance animation
                const noteCardEl = notesList.lastElementChild;
                if (noteCardEl) {
                    noteCardEl.style.opacity = '0';
                    noteCardEl.style.transform = 'translateY(20px)';
                    setTimeout(() => {
                        noteCardEl.style.transition = 'all 0.5s cubic-bezier(0.4, 0, 0.2, 1)';
                        noteCardEl.style.opacity = '1';
                        noteCardEl.style.transform = 'translateY(0)';
                    }, 10);
                }
            });
    }

    function renderTasks() {
        renderCalendar();
        renderTaskCards();
    }

    function renderTaskCards() {
        const { tasksList, tasksEmpty } = selectors;
        if (!tasksList) return;
        tasksList.innerHTML = '';

        const selectedDate = state.ui.selectedDate || todayString();
        let itemsForDate = getCalendarItemsForDate(selectedDate);
        
        // Apply filter if set
        const filter = state.ui.taskFilter || 'all';
        if (filter !== 'all') {
            const now = new Date().getTime();
            itemsForDate = itemsForDate.filter(item => {
                const dueDate = new Date(item.dueDate).getTime();
                if (filter === 'pending') {
                    return !item.done && dueDate >= now;
                } else if (filter === 'completed' || filter === 'done') {
                    return item.done;
                } else if (filter === 'overdue') {
                    return !item.done && dueDate < now;
                }
                return true;
            });
        } else {
            // By default, show all tasks including completed (but styled differently)
            // Completed tasks are shown but with reduced opacity
        }

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
                tasksList.appendChild(fragment);
                
                // Trigger entrance animation for debt reminder
                const debtCardEl = tasksList.lastElementChild;
                if (debtCardEl) {
                    debtCardEl.style.opacity = '0';
                    debtCardEl.style.transform = 'translateY(20px)';
                    setTimeout(() => {
                        debtCardEl.style.transition = 'all 0.5s cubic-bezier(0.4, 0, 0.2, 1)';
                        debtCardEl.style.opacity = '1';
                        debtCardEl.style.transform = 'translateY(0)';
                    }, 10);
                }
            } else {
                const fragment = document.importNode(templates.taskCard.content, true);
                localizeFragment(fragment);
                const card = fragment.querySelector('.task-card');
                card.dataset.taskId = item.id;
                card.querySelector('.task-name').textContent = item.name;
                card.querySelector('.task-type').textContent = translateTaskType(item.type);
                card.querySelector('.task-date').textContent = formatDisplayDate(item.dueDate);
                
                // Add payment info for payment tasks
                const payInfoEl = card.querySelector('.task-pay-info');
                if (payInfoEl && item.type === 'payment') {
                    payInfoEl.innerHTML = `
                        <div class="pay-date">${state.language === 'bn' ? 'পেমেন্ট তারিখ' : 'Payment Date'}: ${formatDisplayDate(item.dueDate)}</div>
                    `;
                    payInfoEl.hidden = false;
                } else if (payInfoEl) {
                    payInfoEl.hidden = true;
                }
                
                card.querySelector('.task-note').textContent = item.note;
                card.querySelector('.task-note').hidden = !item.note;
                const checkbox = card.querySelector('input[type="checkbox"]');
                checkbox.checked = item.done;
                
                // Add completed class for styling
                if (item.done) {
                    card.classList.add('completed');
                }
                
                const doneLabel = card.querySelector('.task-status span');
                doneLabel.textContent = item.done ? translate('tasks.card.completed') : translate('tasks.card.done');
                checkbox.addEventListener('change', () => {
                    item.done = checkbox.checked;
                    if (!item.done) {
                        item.reminderSent = false;
                        card.classList.remove('completed');
                    } else {
                        // Mark as completed
                        card.classList.add('completed');
                        // Add completion animation
                        checkbox.style.animation = 'bounce 0.5s ease';
                        setTimeout(() => {
                            checkbox.style.animation = '';
                        }, 500);
                    }
                    saveState();
                    renderTasks();
                });

                const taskCard = card;
                card.querySelector('[data-action="delete"]').addEventListener('click', () => {
                    // Add delete animation
                    taskCard.style.animation = 'zoomOut 0.3s ease';
                    taskCard.style.opacity = '0';
                    setTimeout(() => {
                        state.tasks = state.tasks.filter(task => task.id !== item.id);
                        saveState();
                        renderTasks();
                    }, 300);
                });

                tasksList.appendChild(fragment);
                
                // Trigger entrance animation
                const taskCardEl = tasksList.lastElementChild;
                if (taskCardEl) {
                    taskCardEl.style.opacity = '0';
                    taskCardEl.style.transform = 'translateY(20px)';
                    setTimeout(() => {
                        taskCardEl.style.transition = 'all 0.5s cubic-bezier(0.4, 0, 0.2, 1)';
                        taskCardEl.style.opacity = '1';
                        taskCardEl.style.transform = 'translateY(0)';
                    }, 10);
                }
            }
        });
    }

    function renderCalendar() {
        const container = selectors.miniCalendar;
        if (!container) return;
        container.innerHTML = '';

        const selectedDate = state.ui.selectedDate || todayString();
        const baseDate = new Date(selectedDate + 'T00:00');
        const year = baseDate.getFullYear();
        const month = baseDate.getMonth();
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

            container.appendChild(button);
        }
    }

    function shiftCalendarMonth(offset) {
        const selectedDate = state.ui.selectedDate || todayString();
        const baseDate = new Date(selectedDate + 'T00:00');
        baseDate.setMonth(baseDate.getMonth() + offset);
        baseDate.setDate(1);
        state.ui.selectedDate = baseDate.toISOString().slice(0, 10);
        saveState();
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
        forms.debt.elements.customerId.value = customer.id;
        forms.debt.elements.date.value = todayString();
        modals.debt.showModal();
        modals.debt.style.animation = 'zoomIn 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)';
    }

    function preparePaymentModal(customer) {
        forms.payment.reset();
        forms.payment.elements.customerId.value = customer.id;
        forms.payment.elements.date.value = todayString();
        modals.payment.showModal();
        modals.payment.style.animation = 'zoomIn 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)';
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
        const outstandingDebts = customer.debts.filter(debt => getDebtOutstanding(debt) > 0);
        if (!outstandingDebts.length) {
            return { status: 'settled', nextDueDate: null };
        }
        const nextDueDebt = outstandingDebts.reduce((earliest, current) => {
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
        return `${date}: ${amount}`;
    }

    function applyLanguage(lang, options = {}) {
        state.language = lang;
        document.documentElement.lang = lang;

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
            renderAll();
        }
    }

    function translate(key) {
        const langTable = translations[state.language] || translations.en;
        const value = langTable[key];
        return value !== undefined ? value : translations.en[key] || key;
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

    function updateShopImagePreview() {
        const preview = selectors.shopImagePreview;
        if (!preview) return;
        if (state.shop.image) {
            preview.innerHTML = `<img src="${state.shop.image}" alt="Shop" />`;
        } else {
            preview.innerHTML = '';
        }
    }

    function handleCalculatorInput(value, action, calcState) {
        const display = selectors.calculatorDisplay;
        if (!display) return;

        if (action === 'clear') {
            calcState.current = '0';
            calcState.previous = null;
            calcState.operation = null;
        } else if (action === 'clear-entry') {
            calcState.current = '0';
        } else if (action === 'backspace') {
            calcState.current = calcState.current.slice(0, -1) || '0';
        } else if (action === 'equals') {
            if (calcState.previous && calcState.operation) {
                const prev = parseFloat(calcState.previous);
                const curr = parseFloat(calcState.current);
                let result = 0;
                switch (calcState.operation) {
                    case '+': result = prev + curr; break;
                    case '-': result = prev - curr; break;
                    case '*': result = prev * curr; break;
                    case '/': result = prev / curr; break;
                }
                calcState.current = result.toString();
                calcState.previous = null;
                calcState.operation = null;
            }
        } else if (value) {
            if (['+', '-', '*', '/'].includes(value)) {
                if (calcState.previous && calcState.operation) {
                    handleCalculatorInput(null, 'equals', calcState);
                }
                calcState.previous = calcState.current;
                calcState.current = '0';
                calcState.operation = value;
                return;
            } else {
                if (calcState.current === '0') {
                    calcState.current = value;
                } else {
                    calcState.current += value;
                }
            }
        }

        display.textContent = calcState.current;
    }

    function renderCardGenerator() {
        const select = selectors.cardCustomerSelect;
        if (!select) return;
        select.innerHTML = '<option value="">-- Select Customer --</option>';
        state.customers.forEach(customer => {
            const balance = getCustomerBalance(customer);
            if (balance > 0) {
                const option = document.createElement('option');
                option.value = customer.id;
                option.textContent = `${customer.name} - ${formatCurrency(balance)}`;
                select.appendChild(option);
            }
        });
        updateCardPreview();
    }

    function updateCardPreview() {
        const shopNameEl = document.getElementById('card-shop-name');
        const shopImageEl = document.getElementById('card-shop-image');
        const amountEl = document.getElementById('card-amount');
        const messageEl = document.getElementById('card-message');
        const methodsEl = document.getElementById('card-payment-methods');

        if (shopNameEl) shopNameEl.textContent = state.shop.name || 'Your Shop';
        if (shopImageEl) {
            if (state.shop.image) {
                shopImageEl.src = state.shop.image;
                shopImageEl.style.display = 'block';
            } else {
                shopImageEl.style.display = 'none';
            }
        }

        const customerId = selectors.cardCustomerSelect?.value;
        if (customerId && amountEl) {
            const customer = state.customers.find(c => c.id === customerId);
            if (customer) {
                amountEl.textContent = formatCurrency(getCustomerBalance(customer));
            }
        } else if (amountEl) {
            amountEl.textContent = '৳0';
        }

        const message = selectors.cardMessageInput?.value || (state.language === 'bn' ? 'অনুগ্রহ করে আপনার বাকি পরিশোধ করুন।' : 'Please pay your outstanding balance.');
        if (messageEl) messageEl.textContent = message;

        if (methodsEl) {
            const phone = selectors.cardPhoneInput?.value || state.shop.phone;
            const bank = selectors.cardBankInput?.value || state.shop.bank;
            methodsEl.innerHTML = '';
            if (phone) {
                const method = document.createElement('div');
                method.className = 'payment-method';
                method.innerHTML = `<span>📱</span><span>${phone}</span>`;
                methodsEl.appendChild(method);
            }
            if (bank) {
                const method = document.createElement('div');
                method.className = 'payment-method';
                method.innerHTML = `<span>🏦</span><span>${bank}</span>`;
                methodsEl.appendChild(method);
            }
        }
    }

    function generatePaymentCard() {
        // Check premium access
        if (!isPremium()) {
            alert(state.language === 'bn' 
                ? 'পেমেন্ট কার্ড তৈরি করতে প্রিমিয়াম প্রয়োজন। সেটিংস থেকে কিনুন।' 
                : 'Premium required to generate payment cards. Purchase from Settings.');
            setActivePanel('settings');
            return;
        }
        
        const customerId = selectors.cardCustomerSelect?.value;
        if (!customerId) {
            alert(state.language === 'bn' ? 'অনুগ্রহ করে একটি ক্রেতা নির্বাচন করুন।' : 'Please select a customer.');
            return;
        }
        updateCardPreview();
        setActivePanel('ai');
        document.querySelector('[data-tab="cards"]')?.click();
    }

    function downloadPaymentCard() {
        const customerId = selectors.cardCustomerSelect?.value;
        if (!customerId) {
            alert(state.language === 'bn' ? 'অনুগ্রহ করে একটি ক্রেতা নির্বাচন করুন।' : 'Please select a customer first.');
            return;
        }
        const customer = state.customers.find(c => c.id === customerId);
        if (!customer) return;

        const amount = formatCurrency(getCustomerBalance(customer));
        const message = selectors.cardMessageInput?.value || (state.language === 'bn'
            ? 'অনুগ্রহ করে আপনার বাকি পরিশোধ করুন।'
            : 'Please pay your outstanding balance.');
        const phone = selectors.cardPhoneInput?.value || state.shop.phone;
        const bank = selectors.cardBankInput?.value || state.shop.bank;
        const colors = getDefaultCardColors();

        createPaymentCardBlob({
            title: customer.name,
            amount,
            message,
            phone,
            bank,
            colors
        }).then(blob => {
            downloadBlobAsImage(blob, `payment-card-${customer.name}-${Date.now()}.png`);
        }).catch(() => {
            alert(state.language === 'bn' ? 'ডাউনলোড ব্যর্থ হয়েছে।' : 'Download failed.');
        });
    }

    function sharePaymentCard() {
        const customerId = selectors.cardCustomerSelect?.value;
        if (!customerId) {
            alert(state.language === 'bn' ? 'অধিকতর তথ্যের জন্য একজন ক্রেতা নির্বাচন করুন।' : 'Select a customer to share.');
            return;
        }
        const customer = state.customers.find(c => c.id === customerId);
        if (!customer) return;

        const amount = formatCurrency(getCustomerBalance(customer));
        const message = selectors.cardMessageInput?.value || (state.language === 'bn'
            ? 'অনুগ্রহ করে আপনার বাকি পরিশোধ করুন।'
            : 'Please pay your outstanding balance.');
        const phone = selectors.cardPhoneInput?.value || state.shop.phone;
        const bank = selectors.cardBankInput?.value || state.shop.bank;
        const colors = getDefaultCardColors();

        createPaymentCardBlob({
            title: customer.name,
            amount,
            message,
            phone,
            bank,
            colors
        }).then(blob => {
            const file = new File([blob], `payment-card-${customer.name}.png`, { type: 'image/png' });
            if (navigator.share && navigator.canShare({ files: [file] })) {
                navigator.share({
                    files: [file],
                    title: 'Payment Request'
                }).catch(() => downloadBlobAsImage(blob, `payment-card-${customer.name}-${Date.now()}.png`));
            } else {
                downloadBlobAsImage(blob, `payment-card-${customer.name}-${Date.now()}.png`);
            }
        }).catch(() => {
            alert(state.language === 'bn' ? 'শেয়ার ব্যর্থ হয়েছে।' : 'Share failed.');
        });
    }

    function downloadBlobAsImage(blob, filename) {
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = filename;
        link.click();
        URL.revokeObjectURL(url);
    }

    function getDefaultCardColors() {
        return ['#1c8b73', '#12644f'];
    }

    function createPaymentCardBlob({ title, amount, message, phone, bank, colors }) {
        return new Promise((resolve, reject) => {
            const canvas = document.createElement('canvas');
            const width = 900;
            const height = 520;
            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext('2d');

            const gradient = ctx.createLinearGradient(0, 0, width, height);
            gradient.addColorStop(0, colors[0]);
            gradient.addColorStop(1, colors[1]);
            ctx.fillStyle = gradient;
            ctx.fillRect(0, 0, width, height);

            ctx.fillStyle = 'rgba(0, 0, 0, 0.2)';
            ctx.fillRect(0, 0, width, height);

            ctx.fillStyle = '#fff';
            ctx.textBaseline = 'top';
            ctx.font = '700 48px Inter, Arial';
            ctx.fillText(title, 60, 80);

            ctx.font = '700 76px Inter, Arial';
            ctx.fillText(amount, 60, 170);

        ctx.font = '500 28px Inter, Arial';
        ctx.fillText(translate('card.paymentRequest') || (state.language === 'bn' ? 'পেমেন্ট অনুরোধ' : 'Payment Request'), 60, 260);

            ctx.font = '400 22px Inter, Arial';
            drawMultilineText(ctx, message, 60, 320, width - 120, 28);

            let methodY = 420;
            ctx.font = '500 24px Inter, Arial';
            if (phone) {
                ctx.fillText(`📱 ${phone}`, 60, methodY);
                methodY += 32;
            }
            if (bank) {
                ctx.fillText(`🏦 ${bank}`, 60, methodY);
            }

            canvas.toBlob(blob => {
                if (blob) {
                    resolve(blob);
                } else {
                    reject(new Error('Could not create image'));
                }
            });
        });
    }

    function drawMultilineText(ctx, text, x, y, maxWidth, lineHeight) {
        const words = text.split(' ');
        let line = '';
        let currentY = y;
        words.forEach(word => {
            const testLine = line + word + ' ';
            const metrics = ctx.measureText(testLine);
            if (metrics.width > maxWidth && line) {
                ctx.fillText(line.trim(), x, currentY);
                line = word + ' ';
                currentY += lineHeight;
            } else {
                line = testLine;
            }
        });
        if (line) {
            ctx.fillText(line.trim(), x, currentY);
        }
    }

    function generateBusinessSummary(lang) {
        const totalCustomers = state.customers.length;
        const totalBalance = state.customers.reduce((sum, c) => sum + getCustomerBalance(c), 0);
        const totalTasks = state.tasks.filter(t => !t.done).length;
        const overdueCount = state.customers.filter(c => {
            const dueInfo = getCustomerDueInfo(c);
            return dueInfo.status === 'overdue';
        }).length;

        let summary = lang === 'bn' ? 'ব্যবসায়িক সারাংশ:\n\n' : 'Business Summary:\n\n';
        summary += lang === 'bn' 
            ? `• মোট ক্রেতা: ${totalCustomers}\n`
            : `• Total Customers: ${totalCustomers}\n`;
        summary += lang === 'bn'
            ? `• মোট বাকি: ${formatCurrency(totalBalance)}\n`
            : `• Total Outstanding: ${formatCurrency(totalBalance)}\n`;
        summary += lang === 'bn'
            ? `• মুলতুবি কাজ: ${totalTasks}\n`
            : `• Pending Tasks: ${totalTasks}\n`;
        summary += lang === 'bn'
            ? `• বাকি পড়েছে: ${overdueCount}`
            : `• Overdue: ${overdueCount}`;

        if (totalBalance > 0) {
            summary += '\n\n' + (lang === 'bn' 
                ? '💡 পরামর্শ: বাকি টাকা সংগ্রহে মনোযোগ দিন।'
                : '💡 Tip: Focus on collecting outstanding amounts.');
        }

        return summary;
    }

})();
