'use strict';

(function () {
    const STORAGE_KEY = 'debtx-data-v1';
    const LS_VERSION = 2;

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
        subscription: {
            plan: 'free', // free, pro, max, ultra
            activatedAt: null,
            expiresAt: null
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
            activePanel: 'customers',
            notesQuery: '',
            notesFilter: 'all',
            notesColorFilter: null, // Array of selected colors or null
            activeNotesTab: 'notes', // notes or tasks
            theme: 'cozy-ledger', // Default theme - warm and calming
            haptics: true,
            sounds: true,
            textSize: 3
        },
        ai: {
            lastSummary: '',
            chatHistory: []
        },
        calculator: {
            expression: '',
            result: '0'
        }
    });

    const translations = {
        en: {
            'nav.customers': 'Customers',
            'nav.bills': 'Bills',
            'nav.ai': 'AI Tools',
            'nav.notesTasks': 'Notes & Tasks',
            'nav.notes': 'Notes',
            'nav.tasks': 'To-Do',
            'nav.settings': 'Settings',
            'ai.title': 'AI Tools',
            'ai.subtitle': 'Calculator, Card Generator & AI Chat',
            'ai.cardGenerator': 'Card Generator',
            'ai.calculator': 'Calculator',
            'ai.chat': 'AI Chat',
            'ai.debtCardTitle': 'Debt Reminder Card Generator',
            'ai.debtCardHint': 'Create beautiful payment reminder cards for your customers',
            'ai.selectCustomer': 'Select Customer',
            'ai.selectLogo': 'Select Shop Logo',
            'ai.customerName': 'Customer Name',
            'ai.debtAmount': 'Debt Amount (৳)',
            'ai.shopName': 'Shop Name',
            'ai.paymentMethod': 'Payment Method',
            'ai.paymentNumber': 'Payment Number/Details',
            'ai.dueDate': 'Due Date',
            'ai.cardColor': 'Card Color',
            'ai.customMessage': 'Custom Message (optional)',
            'ai.generateCard': 'Generate Card',
            'ai.requiresPremium': '🔒 This feature requires a premium subscription. Upgrade to Pro, Max, or Ultra to create custom cards.',
            'ai.preview': 'Preview',
            'ai.downloadCard': '📥 Download',
            'ai.shareCard': '📤 Share',
            'calculator.title': 'Calculator',
            'calculator.subtitle': 'Quick calculations for your shop',
            'customers.title': 'Customers & Debts',
            'customers.subtitle': 'Manage customer accounts and track payments',
            'customers.addCustomer': '+ Add Customer',
            'customers.searchPlaceholder': 'Search by name or phone',
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
            'customers.card.historyTitle': 'Transaction History',
            'customers.card.settled': 'All Paid',
            'customers.card.onTrack': 'On Schedule',
            'customers.card.dueSoon': 'Due Soon',
            'customers.card.overdue': 'Overdue',
            'notes.title': 'Todos',
            'notes.subtitle': 'Keep quick reminders in one place',
            'notesTasks.title': 'Todos & Tasks',
            'notesTasks.subtitle': 'Keep todos and track your tasks',
            'notes.addNote': '+ New Todo',
            'notes.searchPlaceholder': 'Search notes',
            'notes.filterAll': 'All',
            'notes.filterPinned': 'Pinned',
            'notes.filterRecent': 'Recent',
            'notes.filterYellow': 'Yellow',
            'notes.filterGreen': 'Green',
            'notes.filterBlue': 'Blue',
            'notes.filterPink': 'Pink',
            'notes.filterGray': 'Gray',
            'notes.empty': 'No notes yet. Create your first note to get started.',
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
            'settings.subscriptionTitle': 'Subscription Plans',
            'settings.subscriptionCurrent': 'Current Plan',
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
            'settings.premiumRequired': 'This feature requires a premium subscription. Please upgrade to continue.',
            'settings.themeImported': 'Theme imported successfully',
            'settings.themeImportError': 'Failed to import theme. Please check the file format',
            'settings.shopName': 'Shop Name',
            'settings.ownerName': 'Owner Name',
            'settings.couponPlaceholder': 'Enter coupon code (optional)',
            'settings.couponValid': 'Coupon valid!',
            'settings.couponInvalid': 'Invalid coupon',
            'settings.redeemCoupon': 'Redeem',
            'settings.readMore': 'Read More',
            'language.english': 'English',
            'language.bengali': 'বাংলা',
            'subscription.pro': 'Pro',
            'subscription.proPrice': '40 ৳ / month',
            'subscription.proDuration': 'Billed monthly',
            'subscription.proBenefit1': 'Unlimited customers',
            'subscription.proBenefit2': 'Advanced debt tracking',
            'subscription.proBenefit3': 'Priority support',
            'subscription.max': 'Max',
            'subscription.maxPrice': '300 ৳ / year',
            'subscription.maxDuration': 'Billed annually (Save 37%)',
            'subscription.maxBenefit1': 'Everything in Pro',
            'subscription.maxBenefit2': 'AI-powered insights',
            'subscription.maxBenefit3': 'Advanced analytics',
            'subscription.maxBenefit4': 'Custom branding',
            'subscription.ultra': 'Ultra Pro',
            'subscription.ultraPrice': '480 ৳ / year',
            'subscription.ultraDuration': 'Billed annually (Save 50%)',
            'subscription.ultraBenefit1': 'Everything in Max',
            'subscription.ultraBenefit2': 'Unlimited AI features',
            'subscription.ultraBenefit3': '24/7 priority support',
            'subscription.ultraBenefit4': 'Early access to features',
            'subscription.ultraBenefit5': 'Custom integrations',
            'subscription.subscribe': 'Subscribe',
            'subscription.bestValue': 'Best Value',
            'subscription.premium': 'Premium',
            'subscription.free': 'Free',
            'subscription.couponPlaceholder': 'Coupon code',
            'subscription.activate': 'Activate',
            'subscription.subscribe': 'Subscribe',
            'subscription.monthlyRenewal': 'Monthly renewal',
            'subscription.yearlyRenewal': 'Yearly renewal',
            'subscription.couponValid': '✓ Valid coupon code',
            'subscription.couponRequired': 'Please enter a coupon code',
            'subscription.buyHint': 'Want to buy a subscription? Visit our Facebook page for payment and confirmation.',
            'subscription.buyCoupon': 'Subscribe on Facebook',
            'subscription.invalidCoupon': 'Invalid coupon code',
            'subscription.activated': 'Subscription activated successfully!',
            'subscription.chatWelcome': 'Need help choosing a plan? Ask me anything about our subscription plans!',
            'subscription.chatPlaceholder': 'Ask about plans...',
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
            'modals.debt.amount': 'Debt Amount (৳)',
            'modals.debt.description': 'Description',
            'modals.debt.date': 'Date',
            'modals.payment.title': 'Record Payment',
            'modals.payment.amount': 'Payment Amount (৳)',
            'modals.payment.date': 'Date',
            'modals.payment.note': 'Note',
            'modals.note.title': 'New Todo',
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
            'modals.task.note': 'Note',
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
            'ai.title': 'AI Assistant',
            'ai.subtitle': 'Get insights and generate cards',
            'ai.welcome': 'Hello! I can help you manage your shop, track payments, generate reminder cards, and more. How can I help you today?',
            'ai.placeholder': 'Ask me anything...',
            'ai.subscriptionRequired': 'AI Assistant requires a subscription. Please subscribe to use this feature.',
            'ai.goToSubscription': 'View Subscription Plans',
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
            'calendar.empty': 'No items for this day Add a task or record a debt'
        },
        bn: {
            'nav.customers': 'ক্রেতা',
            'nav.bills': 'বিল',
            'nav.ai': 'এআই টুলস',
            'nav.notesTasks': 'নোট ও কাজ',
            'nav.notes': 'নোট',
            'nav.tasks': 'করণীয়',
            'nav.settings': 'সেটিংস',
            'ai.title': 'এআই টুলস',
            'ai.subtitle': 'ক্যালকুলেটর, কার্ড জেনারেটর ও এআই চ্যাট',
            'ai.cardGenerator': 'কার্ড জেনারেটর',
            'ai.calculator': 'ক্যালকুলেটর',
            'ai.chat': 'এআই চ্যাট',
            'ai.debtCardTitle': 'ঋণ কার্ড জেনারেটর',
            'ai.debtCardHint': 'আপনার ক্রেতাদের জন্য কাস্টম ঋণ অনুস্মারক কার্ড তৈরি করুন',
            'ai.selectCustomer': 'ক্রেতা নির্বাচন করুন',
            'ai.selectLogo': 'দোকানের লোগো নির্বাচন করুন',
            'ai.customerName': 'ক্রেতার নাম',
            'ai.debtAmount': 'ঋণের পরিমাণ (৳)',
            'ai.shopName': 'দোকানের নাম',
            'ai.paymentMethod': 'পেমেন্ট পদ্ধতি',
            'ai.paymentNumber': 'পেমেন্ট নম্বর/বিবরণ',
            'ai.dueDate': 'শেষ তারিখ',
            'ai.cardColor': 'কার্ডের রঙ',
            'ai.customMessage': 'কাস্টম বার্তা (ঐচ্ছিক)',
            'ai.generateCard': 'কার্ড তৈরি করুন',
            'ai.requiresPremium': '🔒 কার্ড জেনারেটরের জন্য প্রিমিয়াম সাবস্ক্রিপশন প্রয়োজন। এই ফিচার ব্যবহার করতে দয়া করে Pro, Max বা Ultra তে আপগ্রেড করুন।',
            'ai.preview': 'প্রিভিউ',
            'ai.downloadCard': '📥 ডাউনলোড',
            'ai.shareCard': '📤 শেয়ার',
            'calculator.title': 'ক্যালকুলেটর',
            'calculator.subtitle': 'দ্রুত হিসাব করুন',
            'customers.title': 'ক্রেতা ও দেনা',
            'customers.subtitle': 'দেনা, পরিশোধ ও অনুস্মারক ট্র্যাক করুন',
            'customers.addCustomer': '+ নতুন ক্রেতা',
            'customers.searchPlaceholder': 'নাম বা ফোন দিয়ে খুঁজুন',
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
            'customers.card.historyTitle': 'লেনদেনের ইতিহাস',
            'customers.card.settled': 'সমস্ত পরিশোধিত',
            'customers.card.onTrack': 'সময়ের মধ্যে',
            'customers.card.dueSoon': 'শীঘ্রই বাকি',
            'customers.card.overdue': 'বাকি পড়েছে',
            'notes.title': 'টুডু',
            'notes.subtitle': 'দ্রুত নোট এক জায়গায় রাখুন',
            'notesTasks.title': 'টুডু ও কাজ',
            'notesTasks.subtitle': 'টুডু রাখুন এবং কাজ ট্র্যাক করুন',
            'notes.addNote': '+ নতুন টুডু',
            'notes.searchPlaceholder': 'নোট খুঁজুন',
            'notes.filterAll': 'সব',
            'notes.filterPinned': 'পিন করা',
            'notes.filterRecent': 'সাম্প্রতিক',
            'notes.filterYellow': 'হলুদ',
            'notes.filterGreen': 'সবুজ',
            'notes.filterBlue': 'নীল',
            'notes.filterPink': 'গোলাপি',
            'notes.filterGray': 'ধূসর',
            'notes.empty': 'এখনও কোনো নোট নেই লেখা শুরু করুন',
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
            'ai.subscriptionRequired': 'এআই সহায়ক (অপ্টিচেইন) ব্যবহার করতে সাবস্ক্রিপশন প্রয়োজন। সাবস্ক্রিপশন নিন।',
            'ai.goToSubscription': 'সাবস্ক্রিপশনে যান',
            'settings.aiRefresh': 'সারাংশ দেখাও',
            'settings.aiEmpty': 'সারাংশ দেখতে বাটনে ট্যাপ করুন',
            'settings.subscriptionTitle': 'সাবস্ক্রিপশন',
            'settings.subscriptionCurrent': 'বর্তমান প্ল্যান',
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
            'language.english': 'English',
            'language.bengali': 'বাংলা',
            'subscription.pro': 'প্রো',
            'subscription.proPrice': '৪০ ৳ / মাস',
            'subscription.proDuration': 'মাসিক বিল',
            'subscription.proBenefit1': 'সীমাহীন ক্রেতা',
            'subscription.proBenefit2': 'উন্নত ঋণ ট্র্যাকিং',
            'subscription.proBenefit3': 'অগ্রাধিকার সহায়তা',
            'subscription.max': 'ম্যাক্স',
            'subscription.maxPrice': '৩০০ ৳ / বছর',
            'subscription.maxDuration': 'বার্ষিক বিল (৩৭% সাশ্রয়)',
            'subscription.maxBenefit1': 'প্রো-এর সবকিছু',
            'subscription.maxBenefit2': 'এআই-চালিত অন্তর্দৃষ্টি',
            'subscription.maxBenefit3': 'উন্নত বিশ্লেষণ',
            'subscription.maxBenefit4': 'কাস্টম ব্র্যান্ডিং',
            'subscription.ultra': 'আল্ট্রা প্রো',
            'subscription.ultraPrice': '৪৮০ ৳ / বছর',
            'subscription.ultraDuration': 'বার্ষিক বিল (৫০% সাশ্রয়)',
            'subscription.ultraBenefit1': 'ম্যাক্স-এর সবকিছু',
            'subscription.ultraBenefit2': 'সীমাহীন এআই ফিচার',
            'subscription.ultraBenefit3': '২৪/৭ অগ্রাধিকার সহায়তা',
            'subscription.ultraBenefit4': 'ফিচারের প্রাথমিক অ্যাক্সেস',
            'subscription.ultraBenefit5': 'কাস্টম ইন্টিগ্রেশন',
            'subscription.subscribe': 'সাবস্ক্রাইব',
            'subscription.bestValue': 'সেরা মূল্য',
            'subscription.premium': 'প্রিমিয়াম',
            'subscription.free': 'ফ্রি',
            'subscription.couponPlaceholder': 'কুপন কোড',
            'subscription.activate': 'সক্রিয় করুন',
            'subscription.subscribe': 'সাবস্ক্রাইব করুন',
            'subscription.monthlyRenewal': 'মাসিক নবায়ন',
            'subscription.yearlyRenewal': 'বার্ষিক নবায়ন',
            'subscription.couponValid': '✓ বৈধ কুপন কোড',
            'subscription.couponRequired': 'অনুগ্রহ করে একটি কুপন কোড লিখুন',
            'subscription.buyHint': 'সাবস্ক্রিপশন কিনতে চান? পেমেন্ট এবং নিশ্চিতকরণের জন্য আমাদের Facebook পেজে যান।',
            'subscription.buyCoupon': 'Facebook এ সাবস্ক্রাইব করুন',
            'subscription.invalidCoupon': 'অবৈধ কুপন কোড',
            'subscription.activated': 'সাবস্ক্রিপশন সফলভাবে সক্রিয় হয়েছে',
            'subscription.chatWelcome': 'প্ল্যান বেছে নিতে সাহায্য চান? আমাদের সাবস্ক্রিপশন প্ল্যান সম্পর্কে যেকোনো কিছু জিজ্ঞাসা করুন!',
            'subscription.chatPlaceholder': 'প্ল্যান সম্পর্কে জিজ্ঞাসা করুন...',
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
            'modals.debt.amount': 'দেনার পরিমাণ (৳)',
            'modals.debt.description': 'বিবরণ',
            'modals.debt.date': 'তারিখ',
            'modals.payment.title': 'পেমেন্ট নিন',
            'modals.payment.amount': 'পেমেন্টের পরিমাণ (৳)',
            'modals.payment.date': 'তারিখ',
            'modals.payment.note': 'নোট',
            'modals.note.title': 'নতুন টুডু',
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
            'modals.task.note': 'নোট',
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
            'ai.title': 'এআই সহায়ক',
            'ai.subtitle': 'ইনসাইট ও কার্ড তৈরি করুন',
            'ai.welcome': 'হ্যালো আমি আপনার দোকান পরিচালনা ট্রাস্ট রেশিও গণনা (জিজ্ঞাসা করুন: "[ক্রেতার নাম] এর ট্রাস্ট রেশিও কত?") পেমেন্ট কার্ড তৈরি ইত্যাদিতে সাহায্য করতে পারি কিছু জিজ্ঞাসা করুন',
            'ai.placeholder': 'কিছু জিজ্ঞাসা করুন',
            'ai.subscriptionRequired': 'এআই সহায়ক (অপ্টিচেইন) ব্যবহার করতে সাবস্ক্রিপশন প্রয়োজন। সাবস্ক্রিপশন নিন।',
            'ai.goToSubscription': 'সাবস্ক্রিপশনে যান',
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
            'calendar.empty': 'এই দিনে কিছু নেই কাজ যোগ করুন বা দেনা লিখুন'
        }
    };

    const state = loadState();
    let lastDemandCardUrl = '';
    let draggedTaskId = '';

    const selectors = {
        nav: {
            customers: document.getElementById('nav-customers'),
            bills: document.getElementById('nav-bills'),
            ai: document.getElementById('nav-ai'),
            notes: document.getElementById('nav-notes'),
            tasks: document.getElementById('nav-tasks'),
            settings: document.getElementById('nav-settings'),
        },
        panels: {
            customers: document.getElementById('panel-customers'),
            bills: document.getElementById('panel-bills'),
            ai: document.getElementById('panel-ai'),
            notes: document.getElementById('panel-notes'),
            tasks: document.getElementById('panel-tasks'),
            settings: document.getElementById('panel-settings')
        },
        languageToggle: document.getElementById('language-toggle'),
        notificationToggle: document.getElementById('notification-toggle'),
        customerList: document.getElementById('customer-list'),
        customersEmpty: document.getElementById('customers-empty'),
        customerSearch: document.getElementById('customer-search'),
        notesList: document.getElementById('notes-list'),
        notesEmpty: document.getElementById('notes-empty'),
        notesSearch: document.getElementById('notes-search'),
        notesFilter: document.getElementById('notes-filter'),
        tasksList: document.getElementById('tasks-list'),
        tasksEmpty: document.getElementById('tasks-empty'),
        miniCalendar: document.getElementById('mini-calendar'),
        addCustomerBtn: document.getElementById('add-customer-btn'),
        addNoteBtn: document.getElementById('add-note-btn'),
        addTaskBtn: document.getElementById('add-task-btn'),
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
        currentPlan: document.getElementById('current-plan'),
        subscriptionExpiry: document.getElementById('subscription-expiry'),
        activateProBtn: document.getElementById('activate-pro-btn'),
        activateMaxBtn: document.getElementById('activate-max-btn'),
        activateUltraBtn: document.getElementById('activate-ultra-btn'),
        couponPro: document.getElementById('coupon-pro'),
        couponMax: document.getElementById('coupon-max'),
        couponUltra: document.getElementById('coupon-ultra'),
        logoListContainer: document.getElementById('logo-list-container'),
        addLogoBtn: document.getElementById('add-logo-btn')
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
        bill: document.getElementById('bill-modal'),
        monthlyWrap: document.getElementById('monthly-wrap-modal'),
        trialPopup: document.getElementById('trial-popup-modal'),
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
        bill: document.getElementById('bill-form'),
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
        
        // Initialize text size button
        const currentSize = state.ui.textSize || 3;
        document.querySelectorAll('.text-size-btn').forEach(btn => {
            if (parseInt(btn.dataset.size) === currentSize) {
                btn.classList.add('active');
            }
        });
        
        // No initial auth overlay - login moved to settings
        renderAll();
        updateSubscriptionDisplay();
        
        startReminderLoop();
        refreshAISummary();
        console.log('Debtx init complete');
        
        // Initialize notes/tasks tab on load
        if (state.ui.activeNotesTab) {
            switchNotesTab(state.ui.activeNotesTab);
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
            parsed.subscription = Object.assign(defaultState().subscription, parsed.subscription || {});
            parsed.shopLogos = parsed.shopLogos || [];
            parsed.calculator = Object.assign(defaultState().calculator, parsed.calculator || {});
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
                subscription: {
                    plan: state.subscription.plan,
                    activatedAt: state.subscription.activatedAt,
                    expiresAt: state.subscription.expiresAt
                },
                ui: {
                    theme: state.ui.theme,
                    haptics: state.ui.haptics,
                    sounds: state.ui.sounds
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
            // Validate minimum structure
            if (!Array.isArray(imported.customers) && !Array.isArray(imported.notes) && !Array.isArray(imported.tasks)) {
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
                        if (idx >= 0) state.tasks[idx] = task;
                    } else {
                        state.tasks.push(task);
                    }
                });
            }
            if (imported.ui) {
                if (imported.ui.theme) {
                    state.ui.theme = imported.ui.theme;
                    applyTheme(state.ui.theme);
                }
                if (typeof imported.ui.haptics === 'boolean') state.ui.haptics = imported.ui.haptics;
                if (typeof imported.ui.sounds === 'boolean') state.ui.sounds = imported.ui.sounds;
            }
            if (imported.language) {
                state.language = imported.language;
                applyLanguage(state.language);
            }
            // Import premium subscription if available
            if (imported.subscription && imported.subscription.plan && imported.subscription.plan !== 'free') {
                state.subscription.plan = imported.subscription.plan;
                state.subscription.activatedAt = imported.subscription.activatedAt || state.subscription.activatedAt;
                state.subscription.expiresAt = imported.subscription.expiresAt || state.subscription.expiresAt;
                updateSubscriptionDisplay();
            }
            saveState();
            renderAll();
            updateUserBadge();
            updateSettingsToggles();
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

        prepared.debts = (prepared.debts || []).map(debt => Object.assign({ paidAmount: 0, reminders: {} }, debt));
        prepared.payments = prepared.payments || [];
        prepared.history = prepared.history || [];
        return prepared;
    }

    function attachNavHandlers() {
        Object.entries(selectors.nav).forEach(([key, btn]) => {
            if (!btn) return;
            btn.dataset.i18n = `nav.${key}`;
            btn.addEventListener('click', () => {
                setActivePanel(key);
            });
        });
        setActivePanel(state.ui.activePanel);
    }

    function attachModalHandlers() {
        document.querySelectorAll('[data-close]').forEach(btn => {
            btn.addEventListener('click', () => {
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
            forms.customer.reset();
            setModalMode(forms.customer, 'create');
            modals.customer.showModal();
        });

        selectors.addNoteBtn?.addEventListener('click', () => {
            forms.note.reset();
            setModalMode(forms.note, 'create');
            forms.note.elements.noteId.value = '';
            forms.note.elements.color.value = 'yellow';
            forms.note.elements.pinned.checked = false;
            modals.note.showModal();
        });

        selectors.addTaskBtn?.addEventListener('click', () => {
            forms.task.reset();
            setModalMode(forms.task, 'create');
            forms.task.elements.dueDate.value = todayString();
            forms.task.elements.priority.value = 'medium';
            forms.task.elements.recurring.checked = false;
            const recurringOptions = document.getElementById('recurring-options');
            if (recurringOptions) recurringOptions.style.display = 'none';
            modals.task.showModal();
        });
        
        // Recurring task toggle
        const recurringCheckbox = forms.task?.elements.recurring;
        const recurringOptions = document.getElementById('recurring-options');
        if (recurringCheckbox && recurringOptions) {
            recurringCheckbox.addEventListener('change', () => {
                recurringOptions.style.display = recurringCheckbox.checked ? 'block' : 'none';
            });
        }
        
        // Subscription read more button
        const readMoreBtn = document.getElementById('subscription-read-more-btn');
        const subscriptionDetails = document.getElementById('subscription-details');
        if (readMoreBtn && subscriptionDetails) {
            readMoreBtn.addEventListener('click', () => {
                const isHidden = subscriptionDetails.style.display === 'none';
                subscriptionDetails.style.display = isHidden ? 'block' : 'none';
                readMoreBtn.innerHTML = isHidden 
                    ? '<span class="title-en">Read Less</span><span class="title-bn">কম পড়ুন</span>'
                    : '<span class="title-en">Read More</span><span class="title-bn">আরও পড়ুন</span>';
            });
        }
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
        selectors.languageToggle?.addEventListener('click', () => {
            const nextLang = state.language === 'en' ? 'bn' : 'en';
            applyLanguage(nextLang);
            saveState();
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

        selectors.customerSearch?.addEventListener('input', () => {
            renderCustomers();
        });

        selectors.notesSearch?.addEventListener('input', event => {
            state.ui.notesQuery = (event.target.value || '').trim().toLowerCase();
            saveState();
            renderNotes();
        });

        // New filter button handlers
        document.querySelectorAll('.filter-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const filter = btn.dataset.filter;
                if (filter) {
                    // Update active state
                    document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
                    btn.classList.add('active');
                    
                    state.ui.notesFilter = filter;
                    saveState();
                    renderNotes();
                    playFeedback();
                }
            });
        });
        
        // Color filter buttons
        document.querySelectorAll('.color-filter-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const color = btn.dataset.color;
                if (color) {
                    // Toggle active state
                    btn.classList.toggle('active');
                    
                    // Update filter to show selected colors
                    const activeColors = Array.from(document.querySelectorAll('.color-filter-btn.active')).map(b => b.dataset.color);
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
            if (!canImportExport()) {
                alert(state.language === 'bn' ? 'ইমপোর্ট/এক্সপোর্ট করতে সাবস্ক্রিপশন প্রয়োজন।' : 'Subscription required for import/export.');
                return;
            }
            exportDataAsJSON();
            playFeedback();
        });

        selectors.importDataInput?.addEventListener('change', async event => {
            if (!canImportExport()) {
                alert(state.language === 'bn' ? 'ইমপোর্ট/এক্সপোর্ট করতে সাবস্ক্রিপশন প্রয়োজন।' : 'Subscription required for import/export.');
                event.target.value = '';
                return;
            }
            const file = event.target.files?.[0];
            if (file) {
                await importDataFromJSON(file);
                playFeedback();
            }
            event.target.value = '';
        });
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
        // All available themes - 6 new professional themes + legacy themes
        const allThemes = [
            // New professional themes
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
            'default': 'cozy-ledger',
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
            safe = 'cozy-ledger'; // Default to cozy-ledger
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
                .register('js/sw.js')
                .catch(error => console.error('Service worker registration failed', error));
        });
    }

    function setActivePanel(panel) {
        state.ui.activePanel = panel;
        Object.entries(selectors.nav).forEach(([key, btn]) => {
            if (!btn) return;
            btn.classList.toggle('active', key === panel);
        });
        Object.entries(selectors.panels).forEach(([key, panelEl]) => {
            if (!panelEl) return;
            panelEl.classList.toggle('active', key === panel);
        });
        
        // Show/hide AI subscription message
        if (panel === 'ai') {
            const aiMessage = document.getElementById('ai-subscription-message');
            const aiContainer = document.getElementById('ai-chat-container');
            if (aiMessage && aiContainer) {
                const hasSubscription = canUseAI();
                aiMessage.hidden = hasSubscription;
                aiContainer.hidden = !hasSubscription;
            }
        }
        
        // Update settings display when settings panel is shown
        if (panel === 'settings') {
            setTimeout(() => {
                updateSettingsDisplay();
            }, 100);
        }
        
        saveState();
    }

    function setModalMode(form, mode) {
        form.dataset.mode = mode;
    }

    function handleCustomerSubmit(event) {
        event.preventDefault();
        
        if (!canAddCustomer()) {
            const message = state.language === 'bn' 
                ? 'ফ্রি ভার্সনে সর্বোচ্চ ৫ জন ক্রেতা যোগ করা যাবে। প্রো প্ল্যান নিন অথবা ৩ দিনের ফ্রি ট্রায়াল নিন।' 
                : 'Free version allows maximum 5 customers. Buy Pro plan or take a free 3-day trial.';
            
            const action = confirm(message + (state.language === 'bn' ? '\n\nফ্রি ট্রায়াল নিতে চান?' : '\n\nWould you like to start a free trial?'));
            if (action) {
                // Start free trial
                const now = new Date();
                state.subscription.plan = 'trial';
                state.subscription.activatedAt = now.toISOString();
                const expiresAt = new Date(now);
                expiresAt.setDate(expiresAt.getDate() + 3); // 3 days trial
                state.subscription.expiresAt = expiresAt.toISOString();
                saveState();
                updateSubscriptionDisplay();
                // Show trial popup
                showTrialPopup();
                // Allow customer to be added now - canAddCustomer will return true for trial
            } else {
                modals.customer?.close();
                return;
            }
        }
        
        const form = event.target;
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
        populateCardCustomerSelect();
        modals.customer.close();
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

    function renderAll() {
        console.log('renderAll running...');
        renderCustomers();
        renderBills();
        renderNotes();
        renderTasks();
        updateNotificationToggle();
        updateSettingsToggles();
        // Shop profile display removed with settings panel
        updateSubscriptionDisplay();
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

            customerList.appendChild(fragment);
        });
    }

    function renderNotes() {
        const { notesList, notesEmpty } = selectors;
        if (!notesList) return;

        notesList.innerHTML = '';
        const query = (state.ui.notesQuery || '').toLowerCase();
        const filter = state.ui.notesFilter || 'all';
        if (selectors.notesSearch) selectors.notesSearch.value = state.ui.notesQuery || '';
        if (selectors.notesFilter) selectors.notesFilter.value = filter;
        
        // Update filter button active states
        document.querySelectorAll('.filter-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.filter === filter);
        });
        
        // Update color filter button active states
        if (state.ui.notesColorFilter) {
            document.querySelectorAll('.color-filter-btn').forEach(btn => {
                btn.classList.toggle('active', state.ui.notesColorFilter.includes(btn.dataset.color));
            });
        }

        const filtered = [...state.notes]
            .filter(note => {
                if (!query) return true;
                return (
                    note.title.toLowerCase().includes(query) ||
                    (note.body || '').toLowerCase().includes(query)
                );
            })
            .filter(note => {
                if (filter === 'all') {
                    // Check color filter if set
                    if (state.ui.notesColorFilter && state.ui.notesColorFilter.length > 0) {
                        return state.ui.notesColorFilter.includes(note.color || 'yellow');
                    }
                    return true;
                }
                if (filter === 'pinned') return note.pinned;
                if (filter === 'recent') {
                    const sevenDaysAgo = Date.now() - (7 * 24 * 60 * 60 * 1000);
                    const isRecent = (note.updatedAt || note.createdAt) > sevenDaysAgo;
                    // Also check color filter if set
                    if (state.ui.notesColorFilter && state.ui.notesColorFilter.length > 0) {
                        return isRecent && state.ui.notesColorFilter.includes(note.color || 'yellow');
                    }
                    return isRecent;
                }
                return note.color === filter;
            })
            .sort((a, b) => (b.pinned - a.pinned) || (b.updatedAt - a.updatedAt) || (b.createdAt - a.createdAt));

        if (!filtered.length) {
            notesEmpty?.removeAttribute('hidden');
            return;
        }
        notesEmpty?.setAttribute('hidden', 'hidden');

        filtered.forEach(note => {
            const fragment = document.importNode(templates.noteCard.content, true);
            localizeFragment(fragment);
            const card = fragment.querySelector('.note-card');
            card.dataset.noteId = note.id;
            card.dataset.color = note.color || 'yellow';
            
            // Mark as pinned
            if (note.pinned) {
                card.classList.add('pinned');
            }
            
            card.querySelector('.note-title').textContent = note.title || translate('notes.addNote');
            card.querySelector('.note-date').textContent = formatDateTime(note.updatedAt || note.createdAt);
            card.querySelector('.note-body').textContent = note.body;

            const colorIndicator = card.querySelector('.note-color-indicator');
            if (colorIndicator) {
                colorIndicator.classList.add(note.color || 'yellow');
                colorIndicator.title = translate(`modals.note.color${(note.color || 'yellow')[0].toUpperCase()}${(note.color || 'yellow').slice(1)}`) || note.color;
            }

            const pinBtn = card.querySelector('.note-pin-btn');
            if (pinBtn) {
                pinBtn.title = note.pinned ? translate('notes.unpin') || 'Unpin' : translate('notes.pin') || 'Pin to top';
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
            }

            const tags = card.querySelector('.note-tags');
            if (tags) {
                tags.innerHTML = '';
                if (note.pinned) {
                    const tag = document.createElement('span');
                    tag.className = 'note-tag';
                    tag.innerHTML = '📌 ' + (translate('notes.filterPinned') || 'Pinned');
                    tags.appendChild(tag);
                }
                const colorTag = document.createElement('span');
                colorTag.className = 'note-tag';
                colorTag.textContent = translate(`modals.note.color${(note.color || 'yellow')[0].toUpperCase()}${(note.color || 'yellow').slice(1)}`) || note.color;
                tags.appendChild(colorTag);
            }

            const editBtn = card.querySelector('[data-action="edit"]');
            editBtn.addEventListener('click', () => {
                forms.note.reset();
                setModalMode(forms.note, 'edit');
                forms.note.elements.title.value = note.title;
                forms.note.elements.body.value = note.body;
                forms.note.elements.color.value = note.color || 'yellow';
                forms.note.elements.pinned.checked = !!note.pinned;
                forms.note.elements.noteId.value = note.id;
                modals.note.showModal();
            });

            const deleteBtn = card.querySelector('[data-action="delete"]');
            deleteBtn.addEventListener('click', () => {
                if (confirm(translate('notes.deleteConfirm') || 'Are you sure you want to delete this note?')) {
                    state.notes = state.notes.filter(item => item.id !== note.id);
                    saveState();
                    renderNotes();
                    playFeedback();
                }
            });

            notesList.appendChild(fragment);
        });
    }

    function renderTasks() {
        renderCalendar();
        updateTaskStats();
        renderTaskCards();
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

    function renderCalendar() {
        const container = selectors.miniCalendar;
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
        forms.debt.elements.customerId.value = customer.id;
        forms.debt.elements.date.value = todayString();
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
        if (entry.type === 'demand') {
            const note = entry.description ? ` – ${entry.description}` : '';
            return `${date}: ⚡ ${amount}${note}`;
        }
        return `${date}: ${amount}`;
    }

    function applyLanguage(lang, options = {}) {
        state.language = lang;
        document.documentElement.lang = lang;
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
            renderAll();
        }
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

        // Bill search
        document.getElementById('bill-search')?.addEventListener('input', () => {
            renderBills();
        });

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
            const cardUrl = await generateBillCard(bill, getCustomizeSettings());
            shareBillCard(cardUrl, bill);
            modals.billCustomize?.close();
        });

        document.getElementById('reset-customize-btn')?.addEventListener('click', () => {
            resetCustomizeSettings();
            if (window.currentBillForCustomize) {
                updateBillPreview(window.currentBillForCustomize);
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

        // AI Chat
        const aiInput = document.getElementById('ai-input');
        const aiSendBtn = document.getElementById('ai-send-btn');
        const aiVoiceBtn = document.getElementById('ai-voice-btn');
        aiSendBtn?.addEventListener('click', handleAIMessage);
        aiInput?.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') handleAIMessage();
        });
        aiVoiceBtn?.addEventListener('click', () => startVoiceInput('ai'));
        
        // Voice input for debt amount
        document.getElementById('debt-amount-voice-btn')?.addEventListener('click', () => {
            startVoiceInput('debt-amount');
        });

        // AI Shortcuts
        document.querySelectorAll('.ai-shortcut-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const suggestion = btn.dataset.suggestion;
                if (suggestion) {
                    const aiInput = document.getElementById('ai-input');
                    if (aiInput) {
                        aiInput.value = suggestion;
                        aiInput.focus();
                        // Auto-send after a brief delay
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

        // Subscription
        selectors.activateProBtn?.addEventListener('click', () => activateSubscription('pro'));
        selectors.activateMaxBtn?.addEventListener('click', () => activateSubscription('max'));
        selectors.activateUltraBtn?.addEventListener('click', () => activateSubscription('ultra'));
        
        // Subscribe buttons - redirect to Facebook
        document.getElementById('subscribe-pro-btn')?.addEventListener('click', () => handleSubscribe('pro'));
        document.getElementById('subscribe-max-btn')?.addEventListener('click', () => handleSubscribe('max'));
        document.getElementById('subscribe-ultra-btn')?.addEventListener('click', () => handleSubscribe('ultra'));
        
        // Coupon validation on input and redeem button handlers
        ['pro', 'max', 'ultra'].forEach(plan => {
            const couponInput = document.getElementById(`coupon-input-${plan}`);
            const redeemBtn = document.getElementById(`redeem-coupon-${plan}`);
            
            if (redeemBtn) {
                redeemBtn.addEventListener('click', () => {
                    const value = couponInput?.value.trim() || '';
                    if (!value) {
                        showCouponFeedback(plan, false, translate('subscription.couponRequired') || 'Please enter a coupon code');
                        playFeedback('error');
                        return;
                    }
                    if (validateCoupon(plan, value)) {
                        // Show success feedback immediately
                        showCouponFeedback(plan, true);
                        // Activate subscription
                        activateSubscription(plan);
                        // Show success message
                        setTimeout(() => {
                            alert(state.language === 'bn' 
                                ? `সফলভাবে ${plan.toUpperCase()} প্ল্যান সক্রিয় করা হয়েছে!` 
                                : `Successfully activated ${plan.toUpperCase()} plan!`);
                        }, 100);
                    } else {
                        showCouponFeedback(plan, false, translate('subscription.invalidCoupon') || 'Invalid coupon code');
                        playFeedback('error');
                    }
                });
            }
            
            if (couponInput) {
                couponInput.addEventListener('input', (e) => {
                    const value = e.target.value.trim();
                    if (value) {
                        const isValid = validateCoupon(plan, value);
                        showCouponFeedback(plan, isValid);
                    } else {
                        showCouponFeedback(plan, false, '');
                    }
                });
            }
        });

        // Logo management
        selectors.addLogoBtn?.addEventListener('click', () => {
            forms.logo?.reset();
            forms.logo.elements.logoId.value = '';
            modals.logo?.showModal();
        });
        forms.logo?.addEventListener('submit', handleLogoSubmit);

        // Update subscription display
        updateSubscriptionDisplay();
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
    }

    function initSettingsHandlers() {
        // Language switching
        document.querySelectorAll('.language-option-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const lang = btn.dataset.lang;
                applyLanguage(lang);
                saveState();
                updateLanguageButtons();
                playFeedback();
            });
        });

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

        // Theme export/import for premium users
        const exportThemeBtn = document.getElementById('export-theme-btn');
        const importThemeInput = document.getElementById('import-theme-input');
        const themeExportSection = document.getElementById('theme-export-section');

        // Show theme export section for premium users
        if (themeExportSection) {
            const hasPremium = state.subscription.plan !== 'free';
            themeExportSection.style.display = hasPremium ? 'block' : 'none';
        }

        exportThemeBtn?.addEventListener('click', () => {
            if (state.subscription.plan === 'free') {
                alert(translate('settings.premiumRequired') || 'Premium subscription required');
                return;
            }
            exportTheme();
        });

        importThemeInput?.addEventListener('change', (e) => {
            if (state.subscription.plan === 'free') {
                alert(translate('settings.premiumRequired') || 'Premium subscription required');
                return;
            }
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

        // Subscription buttons - check for coupon code first
        document.querySelectorAll('.plan-subscribe-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                const plan = btn.dataset.plan;
                handleSubscribe(plan);
            });
        });

        // Coupon inputs
        ['pro', 'max'].forEach(plan => {
            const couponInput = document.getElementById(`coupon-input-${plan}`);
            const couponFeedback = document.getElementById(`coupon-feedback-${plan}`);
            
            if (couponInput) {
                couponInput.addEventListener('input', (e) => {
                    const value = e.target.value.trim();
                    if (value) {
                        const isValid = validateCoupon(plan, value);
                        showCouponFeedback(plan, isValid, couponFeedback);
                    } else {
                        if (couponFeedback) {
                            couponFeedback.textContent = '';
                            couponFeedback.className = 'coupon-feedback';
                        }
                    }
                });
            }
        });

        // Initialize settings display
        updateSettingsDisplay();
        
        // Call additional settings handlers
        initSettingsHandlers2();
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

        // Update shop logo and photo previews
        updateShopLogoPreview();
        updateMyPhotoPreview();

        // Update subscription display
        updateSubscriptionDisplay();

        // Update monthly wrap
        updateMonthlyWrapPreview();
    }

    function updateShopLogoPreview() {
        const preview = document.getElementById('settings-shop-logo-preview');
        const placeholder = document.getElementById('settings-shop-logo-placeholder');
        if (!preview) return;

        if (state.shop.shopLogo) {
            if (placeholder) placeholder.hidden = true;
            preview.innerHTML = `<img src="${state.shop.shopLogo}" alt="Shop Logo">`;
        } else {
            if (placeholder) placeholder.hidden = false;
            preview.innerHTML = '<span id="settings-shop-logo-placeholder">🏪</span>';
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

    function showCouponFeedback(plan, isValid, feedbackEl) {
        if (!feedbackEl) {
            feedbackEl = document.getElementById(`coupon-feedback-${plan}`);
        }
        if (!feedbackEl) return;

        if (isValid) {
            feedbackEl.textContent = translate('settings.couponValid') || 'Coupon valid!';
            feedbackEl.className = 'coupon-feedback success';
        } else if (feedbackEl.textContent) {
            feedbackEl.textContent = translate('settings.couponInvalid') || 'Invalid coupon';
            feedbackEl.className = 'coupon-feedback error';
        } else {
            feedbackEl.textContent = '';
            feedbackEl.className = 'coupon-feedback';
        }
    }

    function validateCoupon(plan, code) {
        // Simple validation - in production, this would check against a server
        // You can add specific coupon codes here
        const validCoupons = {
            pro: ['TERENCEPROXOFCL', 'PRO2024', 'PRO50'],
            max: ['TERENCEMAXO', 'MAX2024', 'MAX50'],
            ultra: ['TERENCEULTRAOFCL']
        };
        
        return validCoupons[plan]?.includes(code.toUpperCase()) || false;
    }

    function handleSubscribe(plan) {
        // Redirect to Facebook page
        const facebookUrl = 'https://www.facebook.com/profile.php?id=61560074175677';
        window.open(facebookUrl, '_blank');
    }

    function updateSubscriptionDisplay() {
        const currentPlanEl = document.getElementById('current-plan-display');
        if (currentPlanEl) {
            const planNames = {
                free: translate('subscription.free') || 'Free',
                pro: translate('subscription.pro') || 'Pro',
                max: translate('subscription.max') || 'Max',
                ultra: translate('subscription.ultra') || 'Ultra Pro'
            };
            currentPlanEl.textContent = planNames[state.subscription.plan] || 'Free';
        }

        // Show/hide theme export section based on subscription
        const themeExportSection = document.getElementById('theme-export-section');
        if (themeExportSection) {
            themeExportSection.style.display = canImportExport() ? 'block' : 'none';
        }
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

    function initSettingsHandlers2() {
        // Language switching - Using buttons
        document.querySelectorAll('.language-option-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const lang = btn.dataset.lang;
                if (lang) {
                    applyLanguage(lang);
                    saveState();
                    updateLanguageButtons();
                    playFeedback();
                }
            });
        });

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

        // Subscription chat
        const subscriptionChatInput = document.getElementById('subscription-chat-input');
        const subscriptionChatSendBtn = document.getElementById('subscription-chat-send-btn');
        if (subscriptionChatSendBtn) {
            subscriptionChatSendBtn.addEventListener('click', handleSubscriptionChat);
        }
        if (subscriptionChatInput) {
            subscriptionChatInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') handleSubscriptionChat();
            });
        }
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

    function handleSubscriptionChat() {
        const input = document.getElementById('subscription-chat-input');
        const messagesContainer = document.getElementById('subscription-chat-messages');
        if (!input || !messagesContainer) return;

        const message = input.value.trim();
        if (!message) return;

        // Add user message
        const userMessage = document.createElement('div');
        userMessage.className = 'subscription-chat-message subscription-chat-user';
        userMessage.innerHTML = `
            <div class="subscription-chat-avatar">👤</div>
            <div class="subscription-chat-content">
                <p>${escapeHtml(message)}</p>
            </div>
        `;
        messagesContainer.appendChild(userMessage);

        // Clear input
        input.value = '';

        // Scroll to bottom
        messagesContainer.scrollTop = messagesContainer.scrollHeight;

        // Generate response
        setTimeout(() => {
            const response = generateSubscriptionChatResponse(message);
            const assistantMessage = document.createElement('div');
            assistantMessage.className = 'subscription-chat-message subscription-chat-assistant';
            assistantMessage.innerHTML = `
                <div class="subscription-chat-avatar">💬</div>
                <div class="subscription-chat-content">
                    <p>${response}</p>
                </div>
            `;
            messagesContainer.appendChild(assistantMessage);
            messagesContainer.scrollTop = messagesContainer.scrollHeight;
        }, 500);
    }

    function generateSubscriptionChatResponse(message) {
        const lowerMessage = message.toLowerCase();
        const lang = state.language === 'bn' ? 'bn' : 'en';

        if (lowerMessage.includes('pro') || lowerMessage.includes('প্রো')) {
            return lang === 'bn' 
                ? 'প্রো প্ল্যান ৩৫ ৳/মাসে। সীমাহীন ক্রেতা, এআই সহায়ক, এবং ডেটা ইমপোর্ট/এক্সপোর্ট সুবিধা পাবেন।'
                : 'Pro plan is 35 ৳/month. You get unlimited customers, AI Assistant, and data import/export features.';
        } else if (lowerMessage.includes('max') || lowerMessage.includes('ম্যাক্স')) {
            return lang === 'bn'
                ? 'ম্যাক্স প্ল্যান ২৮০ ৳/বছরে। সব প্রো ফিচার, ১ বছর অ্যাক্সেস, এবং অগ্রাধিকার সহায়তা পাবেন।'
                : 'Max plan is 280 ৳/year. You get all Pro features, 1 year access, and priority support.';
        } else if (lowerMessage.includes('ultra') || lowerMessage.includes('আল্ট্রা')) {
            return lang === 'bn'
                ? 'আল্ট্রা প্ল্যান ৫০০ ৳/বছরে। সব ম্যাক্স ফিচার, প্রিমিয়াম ফিচার, এবং বর্ধিত সহায়তা পাবেন।'
                : 'Ultra plan is 500 ৳/year. You get all Max features, premium features, and extended support.';
        } else if (lowerMessage.includes('price') || lowerMessage.includes('কত') || lowerMessage.includes('দাম')) {
            return lang === 'bn'
                ? 'প্রো: ৩৫ ৳/মাস, ম্যাক্স: ২৮০ ৳/বছর, আল্ট্রা: ৫০০ ৳/বছর। কুপন কোড দিয়ে সক্রিয় করতে পারেন।'
                : 'Pro: 35 ৳/month, Max: 280 ৳/year, Ultra: 500 ৳/year. You can activate with a coupon code.';
        } else if (lowerMessage.includes('coupon') || lowerMessage.includes('কুপন')) {
            return lang === 'bn'
                ? 'কুপন কোড দিয়ে প্ল্যান সক্রিয় করতে পারেন। কুপন কিনতে আমাদের Facebook পেজে যান।'
                : 'You can activate plans with coupon codes. Visit our Facebook page to buy coupons.';
        } else if (lowerMessage.includes('feature') || lowerMessage.includes('সুবিধা')) {
            return lang === 'bn'
                ? 'প্রো: সীমাহীন ক্রেতা, এআই সহায়ক, ডেটা ইমপোর্ট/এক্সপোর্ট। ম্যাক্স: সব প্রো + ১ বছর + অগ্রাধিকার সহায়তা। আল্ট্রা: সব ম্যাক্স + প্রিমিয়াম ফিচার।'
                : 'Pro: Unlimited customers, AI Assistant, data import/export. Max: All Pro + 1 year + priority support. Ultra: All Max + premium features.';
        } else {
            return lang === 'bn'
                ? 'আমি আপনাকে সাবস্ক্রিপশন প্ল্যান সম্পর্কে সাহায্য করতে পারি। প্রো, ম্যাক্স, বা আল্ট্রা প্ল্যান সম্পর্কে জানতে চান?'
                : 'I can help you with subscription plans. Would you like to know about Pro, Max, or Ultra plans?';
        }
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
        const settings = customizeSettings || getCustomizeSettings();
        const canvas = document.createElement('canvas');
        const baseWidth = 1200;
        const baseHeight = 2000; // Increased for more content
        const scale = 3; // Higher scale for better quality
        canvas.width = baseWidth * scale;
        canvas.height = baseHeight * scale;
        const ctx = canvas.getContext('2d');
        ctx.scale(scale, scale);

        // Background
        ctx.fillStyle = settings.bgColor || '#ffffff';
        ctx.fillRect(0, 0, baseWidth, baseHeight);

        // Border
        if (settings.showBorder) {
            ctx.strokeStyle = settings.primaryColor || '#1c8b73';
            ctx.lineWidth = (settings.borderWidth || 2);
            ctx.strokeRect(settings.borderWidth / 2, settings.borderWidth / 2, 
                          baseWidth - settings.borderWidth, baseHeight - settings.borderWidth);
        }

        const spacing = settings.spacing || 16;
        const baseFontSize = 14 + (settings.fontSize || 0);
        let y = spacing * 2;
        
        // Helper function to draw text with word wrap - fixed to handle text bugs
        const drawText = (text, x, yPos, maxWidth, fontSize, color = '#1d2b2f', align = 'left', bold = false) => {
            ctx.fillStyle = color;
            ctx.font = `${bold ? 'bold ' : ''}${fontSize}px ${settings.font || 'Inter'}, sans-serif`;
            ctx.textAlign = align;
            // Ensure text is a string and handle newlines
            const textStr = String(text || '').replace(/\n/g, ' ');
            const words = textStr.split(' ');
            let line = '';
            let currentY = yPos;
            
            words.forEach((word) => {
                if (!word) return;
                const testLine = line + word + ' ';
                const metrics = ctx.measureText(testLine);
                if (metrics.width > maxWidth && line) {
                    ctx.fillText(line.trim(), x, currentY);
                    line = word + ' ';
                    currentY += fontSize * 1.4;
                } else {
                    line = testLine;
                }
            });
            if (line) {
                ctx.fillText(line.trim(), x, currentY);
            }
            return currentY + fontSize * 0.5;
        };

        const leftMargin = spacing * 2;
        const rightMargin = baseWidth - spacing * 2;
        const contentWidth = rightMargin - leftMargin;

        // Shop logo
        if (settings.logoUrl) {
            try {
                const logo = await loadImage(settings.logoUrl);
                const logoSize = 80;
                ctx.drawImage(logo, leftMargin, y, logoSize, logoSize);
                y += logoSize + spacing;
            } catch (e) {
                console.warn('Logo load failed', e);
            }
        }

        // Shop info
        const shopName = String(state.shop?.shopName || 'Shop Name');
        y = drawText(shopName, leftMargin, y, contentWidth, baseFontSize + 8, settings.primaryColor, 'left', true);
        y += spacing / 2;
        
        if (state.shop?.ownerName) {
            y = drawText(String(state.shop.ownerName), leftMargin, y, contentWidth, baseFontSize - 2, '#4a5568', 'left', false);
        }
        y += spacing * 1.5;

        // Divider
        ctx.strokeStyle = settings.primaryColor + '40';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(leftMargin, y);
        ctx.lineTo(rightMargin, y);
        ctx.stroke();
        y += spacing;

        // Invoice header
        const invoiceText = `Invoice: ${bill.invoiceNumber || generateInvoiceNumber()}`;
        y = drawText(invoiceText, leftMargin, y, contentWidth, baseFontSize + 2, '#1d2b2f', 'left', true);
        y += spacing / 2;
        
        const dateText = `Date: ${formatDisplayDate(bill.date)}`;
        y = drawText(dateText, leftMargin, y, contentWidth, baseFontSize, '#1d2b2f', 'left', false);
        y += spacing / 2;
        
        const customerText = `Customer: ${bill.customerName || 'Customer'}`;
        y = drawText(customerText, leftMargin, y, contentWidth, baseFontSize, '#1d2b2f', 'left', false);
        
        if (bill.dueDate) {
            y += spacing / 2;
            const dueDateText = `Due Date: ${formatDisplayDate(bill.dueDate)}`;
            const dueColor = bill.dueDate < todayString() ? '#dc2626' : '#4a5568';
            y = drawText(dueDateText, leftMargin, y, contentWidth, baseFontSize, dueColor, 'left', false);
        }
        y += spacing * 1.5;

        // Divider
        ctx.beginPath();
        ctx.moveTo(leftMargin, y);
        ctx.lineTo(rightMargin, y);
        ctx.stroke();
        y += spacing;

        // Items header
        y = drawText('Items:', leftMargin, y, contentWidth, baseFontSize + 2, settings.primaryColor, 'left', true);
        y += spacing / 2;

        // Products
        if (bill.products && bill.products.length > 0) {
            bill.products.forEach(product => {
                const itemName = String(product.name || 'Item');
                const qty = product.quantity || 1;
                const price = product.price || 0;
                const discount = product.discount || 0;
                const itemTotal = product.subtotal || (price * qty * (1 - discount / 100));
                
                let itemText = `${itemName} × ${qty}`;
                if (discount > 0) {
                    itemText += ` (${discount}% off)`;
                }
                
                // Draw item name and quantity on left
                const itemY = drawText(itemText, leftMargin, y, contentWidth * 0.7, baseFontSize, '#1d2b2f', 'left', false);
                
                // Draw price on right
                ctx.fillStyle = '#1d2b2f';
                ctx.font = `bold ${baseFontSize}px ${settings.font || 'Inter'}, sans-serif`;
                ctx.textAlign = 'right';
                ctx.fillText(formatCurrency(itemTotal), rightMargin, y);
                ctx.textAlign = 'left';
                
                y = itemY + spacing / 3;
            });
        } else {
            y = drawText('No items', leftMargin, y, contentWidth, baseFontSize, '#9ca3af', 'left', false);
        }
        y += spacing;

        // Divider
        ctx.beginPath();
        ctx.moveTo(leftMargin, y);
        ctx.lineTo(rightMargin, y);
        ctx.stroke();
        y += spacing;

        // Totals
        ctx.textAlign = 'right';
        const subtotalText = `Subtotal: ${formatCurrency(bill.subtotal || bill.total)}`;
        y = drawText(subtotalText, rightMargin, y, contentWidth, baseFontSize, '#1d2b2f', 'right', false);
        
        if (bill.discountAmount > 0) {
            y += spacing / 2;
            const discountText = `Discount: -${formatCurrency(bill.discountAmount)}`;
            y = drawText(discountText, rightMargin, y, contentWidth, baseFontSize, '#16a34a', 'right', false);
        }
        
        if (bill.taxAmount > 0) {
            y += spacing / 2;
            const taxText = `Tax: ${formatCurrency(bill.taxAmount)}`;
            y = drawText(taxText, rightMargin, y, contentWidth, baseFontSize, '#1d2b2f', 'right', false);
        }
        
        y += spacing / 2;
        ctx.beginPath();
        ctx.moveTo(leftMargin, y);
        ctx.lineTo(rightMargin, y);
        ctx.stroke();
        y += spacing / 2;
        
        // Total
        const totalText = `Total: ${formatCurrency(bill.total || 0)}`;
        y = drawText(totalText, rightMargin, y, contentWidth, baseFontSize + 4, settings.primaryColor, 'right', true);
        ctx.textAlign = 'left';
        y += spacing * 1.5;

        // Notes
        const notesText = (bill.notes || '') + (settings.customNotes ? '\n' + settings.customNotes : '');
        if (notesText.trim()) {
            y = drawText('Notes: ' + notesText, leftMargin, y, contentWidth, baseFontSize - 2, '#4a5568', 'left', false);
            y += spacing;
        }

        // Payment info
        if (state.shop?.paymentMethods) {
            const methods = [];
            if (state.shop.paymentMethods.bkash?.enabled && state.shop.paymentMethods.bkash.number) {
                methods.push(`bKash: ${state.shop.paymentMethods.bkash.number}`);
            }
            if (state.shop.paymentMethods.nagad?.enabled && state.shop.paymentMethods.nagad.number) {
                methods.push(`Nagad: ${state.shop.paymentMethods.nagad.number}`);
            }
            if (state.shop.paymentMethods.rocket?.enabled && state.shop.paymentMethods.rocket.number) {
                methods.push(`Rocket: ${state.shop.paymentMethods.rocket.number}`);
            }
            if (methods.length > 0) {
                y += spacing / 2;
                methods.forEach((method) => {
                    y = drawText(method, leftMargin, y, contentWidth, baseFontSize - 1, '#4a5568', 'left', false);
                });
            }
        }

        // Payment status
        if (bill.paymentStatus) {
            y += spacing;
            const statusText = `Status: ${bill.paymentStatus.charAt(0).toUpperCase() + bill.paymentStatus.slice(1)}`;
            const statusColor = bill.paymentStatus === 'paid' ? '#16a34a' : 
                              bill.paymentStatus === 'partial' ? '#2563eb' : '#d97706';
            y = drawText(statusText, leftMargin, y, contentWidth, baseFontSize, statusColor, 'left', false);
        }

        return canvas.toDataURL('image/png', 1.0);
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
        const baseFontSize = 14 + settings.fontSize;
        const headingSize = baseFontSize + 6;
        const iconSize = settings.showIcons ? '1.2em' : '0';
        
        // Escape HTML to prevent text bugs
        const escapeHtml = (text) => {
            const div = document.createElement('div');
            div.textContent = text;
            return div.innerHTML;
        };

        const shopName = escapeHtml(state.shop?.shopName || 'Shop Name');
        const invoiceNum = escapeHtml(bill.invoiceNumber || generateInvoiceNumber());
        const customerName = escapeHtml(bill.customerName || 'Customer');
        const dateStr = formatDisplayDate(bill.date);
        
        const previewHTML = `
            <div class="bill-preview-card" style="
                background: ${settings.bgColor};
                border: ${settings.showBorder ? `${settings.borderWidth}px solid ${settings.primaryColor}` : 'none'};
                border-radius: 8px;
                padding: ${settings.spacing}px;
                font-family: '${settings.font}', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
                font-size: ${baseFontSize}px;
                color: #1d2b2f;
                max-width: 100%;
                box-shadow: 0 2px 8px rgba(0,0,0,0.1);
            ">
                ${settings.logoUrl ? `<img src="${settings.logoUrl}" style="width: 60px; height: 60px; margin-bottom: ${settings.spacing}px; border-radius: 4px; object-fit: contain;" alt="Logo" />` : ''}
                <h3 style="color: ${settings.primaryColor}; margin: 0 0 ${settings.spacing / 2}px 0; font-size: ${headingSize}px; font-weight: 700;">
                    ${shopName}
                </h3>
                ${state.shop?.ownerName ? `<p style="margin: 0 0 ${settings.spacing}px 0; font-size: ${baseFontSize - 2}px; color: #4a5568;">${escapeHtml(state.shop.ownerName)}</p>` : ''}
                <div style="margin: ${settings.spacing}px 0; padding: ${settings.spacing / 2}px 0; border-top: 1px solid ${settings.primaryColor}20; border-bottom: 1px solid ${settings.primaryColor}20;">
                    <p style="margin: ${settings.spacing / 2}px 0; font-weight: 600; color: ${settings.primaryColor};">
                        ${settings.showIcons ? '📄 ' : ''}Invoice: ${invoiceNum}
                    </p>
                    <p style="margin: ${settings.spacing / 2}px 0; font-size: ${baseFontSize - 1}px;">
                        ${settings.showIcons ? '📅 ' : ''}Date: ${dateStr}
                    </p>
                    <p style="margin: ${settings.spacing / 2}px 0; font-size: ${baseFontSize - 1}px;">
                        ${settings.showIcons ? '👤 ' : ''}Customer: ${customerName}
                    </p>
                    ${bill.dueDate ? `<p style="margin: ${settings.spacing / 2}px 0; font-size: ${baseFontSize - 1}px; color: ${bill.dueDate < todayString() ? '#dc2626' : '#4a5568'};">
                        ${settings.showIcons ? '⏰ ' : ''}Due: ${formatDisplayDate(bill.dueDate)}
                    </p>` : ''}
                </div>
                <div style="margin: ${settings.spacing}px 0;">
                    <p style="margin: 0 0 ${settings.spacing / 2}px 0; font-weight: 600; color: ${settings.primaryColor};">
                        ${settings.showIcons ? '📦 ' : ''}Items:
                    </p>
                    ${bill.products && bill.products.length > 0 ? bill.products.map(p => {
                        const itemName = escapeHtml(p.name || 'Item');
                        const qty = p.quantity || 1;
                        const price = p.price || 0;
                        const discount = p.discount || 0;
                        const itemTotal = p.subtotal || (price * qty * (1 - discount / 100));
                        return `
                            <p style="margin: ${settings.spacing / 3}px 0; font-size: ${baseFontSize - 1}px; display: flex; justify-content: space-between;">
                                <span>${itemName} × ${qty}${discount > 0 ? ` (${discount}% off)` : ''}</span>
                                <strong>${formatCurrency(itemTotal)}</strong>
                            </p>
                        `;
                    }).join('') : '<p style="margin: 4px 0; color: #9ca3af;">No items</p>'}
                </div>
                <div style="margin: ${settings.spacing}px 0; padding-top: ${settings.spacing}px; border-top: 2px solid ${settings.primaryColor};">
                    <p style="margin: ${settings.spacing / 2}px 0; display: flex; justify-content: space-between; font-size: ${baseFontSize - 1}px;">
                        <span>Subtotal:</span>
                        <strong>${formatCurrency(bill.subtotal || bill.total)}</strong>
                    </p>
                    ${bill.discountAmount > 0 ? `<p style="margin: ${settings.spacing / 2}px 0; display: flex; justify-content: space-between; font-size: ${baseFontSize - 1}px; color: #16a34a;">
                        <span>Discount:</span>
                        <strong>-${formatCurrency(bill.discountAmount)}</strong>
                    </p>` : ''}
                    ${bill.taxAmount > 0 ? `<p style="margin: ${settings.spacing / 2}px 0; display: flex; justify-content: space-between; font-size: ${baseFontSize - 1}px;">
                        <span>Tax:</span>
                        <strong>${formatCurrency(bill.taxAmount)}</strong>
                    </p>` : ''}
                    <p style="margin: ${settings.spacing}px 0 0 0; padding-top: ${settings.spacing / 2}px; border-top: 1px solid ${settings.primaryColor}40; display: flex; justify-content: space-between; font-size: ${baseFontSize + 2}px; font-weight: 700; color: ${settings.primaryColor};">
                        <span>Total:</span>
                        <strong>${formatCurrency(bill.total || 0)}</strong>
                    </p>
                </div>
                ${bill.notes || settings.customNotes ? `<div style="margin: ${settings.spacing}px 0; padding: ${settings.spacing / 2}px; background: ${settings.bgColor === '#ffffff' ? '#f8fafc' : settings.bgColor}; border-radius: 4px; font-size: ${baseFontSize - 2}px; color: #4a5568;">
                    <strong>Notes:</strong> ${escapeHtml(bill.notes || '')} ${escapeHtml(settings.customNotes || '')}
                </div>` : ''}
                ${bill.paymentStatus ? `<p style="margin: ${settings.spacing / 2}px 0; font-size: ${baseFontSize - 1}px; color: ${bill.paymentStatus === 'paid' ? '#16a34a' : bill.paymentStatus === 'partial' ? '#2563eb' : '#d97706'};">
                    Status: ${bill.paymentStatus.charAt(0).toUpperCase() + bill.paymentStatus.slice(1)}
                </p>` : ''}
            </div>
        `;
        previewContainer.innerHTML = previewHTML;
    }

    async function shareBillCard(dataUrl, bill) {
        try {
            if (navigator.share) {
                const file = await dataUrlToFile(dataUrl, `bill-${bill.invoiceNumber || bill.id}.png`);
                await navigator.share({ files: [file], text: `Bill for ${bill.customerName} - ${formatCurrency(bill.total)}` });
            } else {
                const link = document.createElement('a');
                link.href = dataUrl;
                link.download = `bill-${bill.invoiceNumber || bill.id}.png`;
                link.click();
            }
        } catch (error) {
            console.error('Share failed', error);
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
            card.querySelector('[data-action="share"]')?.addEventListener('click', async (e) => {
                e.stopPropagation();
                const cardUrl = await generateBillCard(bill);
                shareBillCard(cardUrl, bill);
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

    async function handleAIMessage() {
        if (!canUseAI()) {
            alert(state.language === 'bn' ? 'এআই সহায়ক (অপ্টিচেইন) ব্যবহার করতে সাবস্ক্রিপশন প্রয়োজন।' : 'Subscription required to use AI Assistant (Optichain).');
            return;
        }
        
        const input = document.getElementById('ai-input');
        const messagesContainer = document.getElementById('ai-messages');
        if (!input || !messagesContainer) return;

        const userMessage = input.value.trim();
        if (!userMessage) return;

        // Add user message
        const userMsgEl = document.createElement('div');
        userMsgEl.className = 'ai-message ai-message-user';
        userMsgEl.innerHTML = `
            <div class="ai-avatar">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
                    <circle cx="12" cy="7" r="4"></circle>
                </svg>
            </div>
            <div class="ai-content"><p>${userMessage}</p></div>
        `;
        messagesContainer.appendChild(userMsgEl);
        input.value = '';
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
        playFeedback();

        // Generate AI response
        const aiResponse = await generateAIResponse(userMessage);
        
        // Add AI response
        const aiMsgEl = document.createElement('div');
        aiMsgEl.className = 'ai-message ai-message-assistant';
        aiMsgEl.innerHTML = `
            <div class="ai-avatar">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
                    <circle cx="8.5" cy="8.5" r="1.5"></circle>
                    <polyline points="21 15 16 10 5 21"></polyline>
                </svg>
            </div>
            <div class="ai-content"><p style="white-space: pre-line;">${aiResponse}</p></div>
        `;
        messagesContainer.appendChild(aiMsgEl);
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
        playFeedback();
    }

    async function generateAIResponse(userMessage) {
        const lower = userMessage.toLowerCase();
        
        // Task management queries
        if (lower.includes('show') && (lower.includes('task') || lower.includes('tasks'))) {
            const incompleteTasks = state.tasks.filter(t => !t.completed);
            if (incompleteTasks.length === 0) {
                return 'You have no pending tasks Great job staying organized';
            }
            let taskList = `You have ${incompleteTasks.length} pending task(s):\n\n`;
            incompleteTasks.forEach((task, i) => {
                const dueDate = new Date(task.dueDate).toLocaleDateString();
                taskList += `${i + 1}. ${task.name} (Due: ${dueDate})\n`;
            });
            return taskList;
        }

        if (lower.includes('add task') || (lower.includes('create') && lower.includes('task'))) {
            return 'To add a task click the "+ Task" button in the Notes & Tasks section or tell me what task you want to add and when its due';
        }

        if (lower.includes('remaining') || lower.includes('left') || lower.includes('pending')) {
            const incompleteTasks = state.tasks.filter(t => !t.completed);
            const today = new Date().toISOString().slice(0, 10);
            const todayTasks = incompleteTasks.filter(t => t.dueDate === today);
            const overdueTasks = incompleteTasks.filter(t => t.dueDate < today);
            
            let response = `Task Summary:\n`;
            response += `• Total pending: ${incompleteTasks.length}\n`;
            response += `• Due today: ${todayTasks.length}\n`;
            response += `• Overdue: ${overdueTasks.length}\n`;
            
            if (todayTasks.length > 0) {
                response += `\nTodays tasks:\n`;
                todayTasks.forEach((task, i) => {
                    response += `${i + 1}. ${task.name}\n`;
                });
            }
            
            return response;
        }
        
        // Trust ratio query
        if (lower.includes('trust') || lower.includes('ratio')) {
            const customerName = extractCustomerName(userMessage);
            if (customerName) {
                const customer = state.customers.find(c => c.name.toLowerCase().includes(customerName.toLowerCase()));
                if (customer) {
                    const trustRatio = calculateTrustRatio(customer);
                    return `[AI Analysis] The trust ratio for ${customer.name} is ${trustRatio}% ${getTrustRatioExplanation(trustRatio)} This is calculated based on payment history and timeliness`;
                }
            }
            return 'I can calculate trust ratios for your customers using AI analysis Try asking "What is the trust ratio for [customer name]" or "Calculate trust ratio for [customer name]"';
        }

        // Generate card query
        if (lower.includes('card') || lower.includes('generate')) {
            const customerName = extractCustomerName(userMessage);
            if (customerName) {
                const customer = state.customers.find(c => c.name.toLowerCase().includes(customerName.toLowerCase()));
                if (customer) {
                    const balance = getCustomerBalance(customer);
                    return `I can generate a payment card for ${customer.name} with a balance of ${formatCurrency(balance)} Would you like me to create it?`;
                }
            }
            return 'I can generate payment cards for your customers Tell me which customer you want a card for';
        }

        // General stats
        if (lower.includes('summary') || lower.includes('stats') || lower.includes('overview')) {
            return buildAISummary();
        }

        // Payment prediction query
        if (lower.includes('predict') || lower.includes('late') || lower.includes('who will pay late') || lower.includes('payment prediction')) {
            return generatePaymentPrediction();
        }

        // Default response
        return `I understand youre asking about "${userMessage}" I can help you with:\n- Show your tasks and whats remaining\n- Add new tasks\n- Calculate customer trust ratios\n- Generate payment cards\n- View monthly summaries\n- Predict who will pay late\n\nWhat would you like to know?`;
    }

    function generatePaymentPrediction() {
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
            return 'Great news! Based on payment history, all your customers are likely to pay on time. No high-risk customers detected.';
        }
        
        predictions.sort((a, b) => {
            if (a.riskLevel === 'High' && b.riskLevel !== 'High') return -1;
            if (b.riskLevel === 'High' && a.riskLevel !== 'High') return 1;
            return a.trustRatio - b.trustRatio;
        });
        
        let response = `[AI Payment Prediction]\n\nBased on payment history analysis, here are customers who may pay late:\n\n`;
        predictions.forEach((pred, i) => {
            response += `${i + 1}. ${pred.name}\n`;
            response += `   Risk Level: ${pred.riskLevel}\n`;
            response += `   Trust Ratio: ${pred.trustRatio}%\n`;
            response += `   Late Payment Rate: ${pred.lateRate.toFixed(1)}%\n`;
            response += `   Overdue Debts: ${pred.overdueCount}\n`;
            response += `   Current Balance: ${formatCurrency(pred.balance)}\n\n`;
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

        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (!recognition) {
            recognition = new SpeechRecognition();
            recognition.continuous = false;
            recognition.interimResults = false;
            recognition.lang = state.language === 'bn' ? 'bn-BD' : 'en-US';
        }

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
                alert(state.language === 'bn' 
                    ? 'কোন শব্দ শোনা যায়নি। আবার চেষ্টা করুন।'
                    : 'No speech detected. Please try again.');
            }
        };

        recognition.onend = () => {
            isRecording = false;
            updateVoiceButtonState(type, false);
        };

        recognition.start();
    }

    function updateVoiceButtonState(type, recording) {
        const btn = type === 'ai' 
            ? document.getElementById('ai-voice-btn')
            : document.getElementById('debt-amount-voice-btn');
        if (btn) {
            btn.classList.toggle('recording', recording);
        }
    }

    function processVoiceInput(transcript, type) {
        if (type === 'ai') {
            const aiInput = document.getElementById('ai-input');
            if (aiInput) {
                aiInput.value = transcript;
                // Process AI commands
                const lower = transcript.toLowerCase();
                if (lower.includes('add debt') || lower.includes('নতুন দেনা') || lower.includes('দেনা যোগ')) {
                    // Extract amount and customer name
                    const amountMatch = transcript.match(/(\d+)/);
                    const customerMatch = extractCustomerName(transcript);
                    if (amountMatch) {
                        // Open debt modal with pre-filled amount
                        setTimeout(() => {
                            const debtModal = modals.debt;
                            const debtForm = forms.debt;
                            if (debtModal && debtForm) {
                                debtForm.querySelector('[name="amount"]').value = amountMatch[1];
                                if (customerMatch) {
                                    const customer = state.customers.find(c => 
                                        c.name.toLowerCase().includes(customerMatch.toLowerCase())
                                    );
                                    if (customer) {
                                        debtForm.querySelector('[name="customerId"]').value = customer.id;
                                    }
                                }
                                debtModal.showModal();
                            }
                        }, 500);
                        return;
                    }
                }
                // Auto-send after processing
                setTimeout(() => handleAIMessage(), 300);
            }
        } else if (type === 'debt-amount') {
            const amountInput = document.querySelector('#debt-form [name="amount"]');
            if (amountInput) {
                const amountMatch = transcript.match(/(\d+)/);
                if (amountMatch) {
                    amountInput.value = amountMatch[1];
                    playFeedback();
                }
            }
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

    function showTrialPopup() {
        const modal = modals.trialPopup;
        if (!modal) return;
        modal.showModal();
        // Auto-close after 5 seconds if user doesn't interact
        setTimeout(() => {
            if (modal.open) {
                modal.close();
            }
        }, 5000);
    }

    function applyTextSize(size) {
        document.documentElement.dataset.textSize = size;
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
        switch(action) {
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
            });
        });
        
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
                        const customerNameInput = document.querySelector('input[name="customerName"]');
                        const debtAmountInput = document.querySelector('input[name="debtAmount"]');
                        
                        if (customerNameInput) customerNameInput.value = customer.name;
                        if (debtAmountInput) {
                            const totalDebt = customer.debts.reduce((sum, d) => sum + d.amount, 0);
                            const totalPaid = customer.payments.reduce((sum, p) => sum + p.amount, 0);
                            debtAmountInput.value = totalDebt - totalPaid;
                        }
                    }
                }
            });
        }
        
        // Debt card generator
        const debtCardForm = document.getElementById('debt-card-form');
        if (debtCardForm) {
            debtCardForm.addEventListener('submit', generateDebtCard);
        }
        
        // Download and share buttons
        const downloadBtn = document.getElementById('download-debt-card-btn');
        const shareBtn = document.getElementById('share-debt-card-btn');
        
        if (downloadBtn) {
            downloadBtn.addEventListener('click', downloadDebtCard);
        }
        if (shareBtn) {
            shareBtn.addEventListener('click', shareDebtCard);
        }
    }
    
    function populateCardCustomerSelect() {
        const customerSelect = document.getElementById('card-customer-select');
        if (!customerSelect) return;
        
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

    function generateDebtCard(event) {
        event.preventDefault();
        
        // Check if user has premium subscription
        if (state.subscription.plan === 'free') {
            alert(translate('ai.requiresPremium') || 'Card Generator requires a premium subscription. Please upgrade to Pro, Max, or Ultra to use this feature.');
            // Scroll to settings subscription section
            setTimeout(() => {
                document.getElementById('nav-settings').click();
                setTimeout(() => {
                    const subscriptionSection = document.querySelector('.settings-card:has(#subscription-status)');
                    if (subscriptionSection) {
                        subscriptionSection.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    }
                }, 100);
            }, 500);
            return;
        }
        
        const formData = new FormData(event.target);
        
        const selectedCustomerId = formData.get('selectedCustomer');
        const selectedLogoId = formData.get('selectedLogo');
        const customerName = formData.get('customerName');
        const debtAmount = formData.get('debtAmount');
        const shopName = formData.get('shopName') || state.shop.shopName || 'Your Shop';
        const paymentMethod = formData.get('paymentMethod');
        const paymentNumber = formData.get('paymentNumber') || '';
        const dueDate = formData.get('dueDate');
        const cardColor = formData.get('cardColor');
        const customMessage = formData.get('customMessage') || '';
        
        // Get selected logo
        let logoHTML = '<div class="card-logo">💳</div>';
        if (selectedLogoId) {
            const selectedLogo = state.shopLogos.find(l => l.id === selectedLogoId);
            if (selectedLogo && selectedLogo.image) {
                logoHTML = `<img src="${selectedLogo.image}" alt="Shop Logo" style="width: 60px; height: 60px; border-radius: 8px; object-fit: cover;">`;
            }
        } else if (state.shop.shopLogo) {
            logoHTML = `<img src="${state.shop.shopLogo}" alt="Shop Logo" style="width: 60px; height: 60px; border-radius: 8px; object-fit: cover;">`;
        }
        
        // Format date
        let dueDateFormatted = '';
        if (dueDate) {
            const date = new Date(dueDate);
            dueDateFormatted = date.toLocaleDateString(state.language === 'bn' ? 'bn-BD' : 'en-US', {
                year: 'numeric',
                month: 'long',
                day: 'numeric'
            });
        }
        
        // Generate card HTML
        const cardHTML = `
            <div class="card-header">
                <div>
                    <p class="card-shop-name">${escapeHtml(shopName)}</p>
                </div>
                ${logoHTML}
            </div>
            <div class="card-body">
                <p class="card-customer-name">${translate('ai.customerName')}: ${escapeHtml(customerName)}</p>
                <p class="card-debt-amount">৳${escapeHtml(debtAmount)}</p>
                <div class="card-details">
                    <div class="card-detail-row">
                        <span>${translate('ai.paymentMethod')}:</span>
                        <strong>${escapeHtml(paymentMethod)}</strong>
                    </div>
                    ${paymentNumber ? `
                    <div class="card-detail-row">
                        <span>${translate('ai.paymentNumber')}:</span>
                        <strong>${escapeHtml(paymentNumber)}</strong>
                    </div>
                    ` : ''}
                    ${dueDateFormatted ? `
                    <div class="card-detail-row">
                        <span>${translate('ai.dueDate')}:</span>
                        <strong>${dueDateFormatted}</strong>
                    </div>
                    ` : ''}
                </div>
                ${customMessage ? `<p class="card-message">"${escapeHtml(customMessage)}"</p>` : ''}
            </div>
        `;
        
        // Update card content and apply color
        const cardContent = document.getElementById('generated-card-content');
        const cardPreview = document.getElementById('debt-card-preview');
        
        if (cardContent && cardPreview) {
            cardContent.innerHTML = cardHTML;
            cardContent.style.background = `linear-gradient(135deg, ${cardColor}, ${adjustColor(cardColor, -20)})`;
            cardPreview.hidden = false;
            
            // Scroll to preview
            cardPreview.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }
    }

    function adjustColor(color, percent) {
        // Convert hex to RGB
        const num = parseInt(color.replace('#', ''), 16);
        const r = Math.max(0, Math.min(255, (num >> 16) + percent));
        const g = Math.max(0, Math.min(255, ((num >> 8) & 0x00FF) + percent));
        const b = Math.max(0, Math.min(255, (num & 0x0000FF) + percent));
        return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')}`;
    }

    function downloadDebtCard() {
        const cardContent = document.getElementById('generated-card-content');
        if (!cardContent) return;
        
        // Use html2canvas if available, otherwise show message
        if (typeof html2canvas !== 'undefined') {
            html2canvas(cardContent).then(canvas => {
                canvas.toBlob(blob => {
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = `debt-card-${Date.now()}.png`;
                    a.click();
                    URL.revokeObjectURL(url);
                });
            });
        } else {
            alert('Download feature requires additional library. Please take a screenshot of the card instead.');
        }
    }

    async function shareDebtCard() {
        const cardContent = document.getElementById('generated-card-content');
        if (!cardContent) return;
        
        try {
            if (navigator.share) {
                // For browsers that support Web Share API
                await navigator.share({
                    title: 'Debt Reminder Card',
                    text: 'Payment reminder from ' + (state.shop?.shopName || 'my shop')
                });
            } else {
                alert('Sharing is not supported on this browser. Please take a screenshot to share.');
            }
        } catch (error) {
            console.error('Error sharing:', error);
        }
    }

    function escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    // Subscription Functions
    function checkSubscription() {
        const sub = state.subscription || { plan: 'free', expiresAt: null };
        if (sub.plan === 'free') {
            updateSubscriptionDisplay();
            return false;
        }
        if (sub.plan === 'trial' && sub.expiresAt && new Date(sub.expiresAt) < new Date()) {
            // Trial expired, revert to free
            state.subscription.plan = 'free';
            state.subscription.activatedAt = null;
            state.subscription.expiresAt = null;
            saveState();
            updateSubscriptionDisplay();
            alert(state.language === 'bn' 
                ? 'ফ্রি ট্রায়াল শেষ হয়ে গেছে। প্রো, ম্যাক্স বা আল্ট্রা প্ল্যান কিনুন অথবা ফ্রি প্ল্যানে ফিরে যান।' 
                : 'Free trial has expired. Please buy Pro, Max, or Ultra plan, or continue with free plan.');
            return false;
        }
        if (sub.expiresAt && new Date(sub.expiresAt) < new Date()) {
            state.subscription.plan = 'free';
            state.subscription.expiresAt = null;
            saveState();
            updateSubscriptionDisplay();
            return false;
        }
        updateSubscriptionDisplay();
        return true;
    }

    function getSubscriptionPlan() {
        checkSubscription();
        return state.subscription?.plan || 'free';
    }

    function validateCoupon(plan, couponCode) {
        const coupons = {
            pro: ['terenceproxofcl', 'TERENCEPROXOFCL'],
            max: ['terencemaxo', 'TERENCEMAXO'],
            ultra: ['terenceultraofcl', 'TERENCEULTRAOFCL']
        };
        
        const enteredCoupon = couponCode.trim();
        const validCoupons = coupons[plan] || [];
        
        return validCoupons.some(c => c.toLowerCase() === enteredCoupon.toLowerCase());
    }
    
    function showCouponFeedback(plan, isValid, message) {
        const feedbackEl = document.getElementById(`coupon-feedback-${plan}`);
        if (!feedbackEl) return;
        
        feedbackEl.textContent = message || '';
        feedbackEl.className = 'coupon-feedback';
        
        if (isValid) {
            feedbackEl.classList.add('success');
            feedbackEl.textContent = translate('subscription.couponValid') || '✓ Valid coupon code';
        } else if (message) {
            feedbackEl.classList.add('error');
        }
    }
    
    function activateSubscription(plan) {
        activateSubscriptionWithCongratulations(plan);
    }
    
    function handleSubscribe(plan) {
        // Check if there's a valid coupon code first
        const couponInput = document.getElementById(`coupon-input-${plan}`);
        const enteredCoupon = couponInput?.value.trim() || '';
        
        // If coupon code is entered and valid, activate subscription
        if (enteredCoupon && validateCoupon(plan, enteredCoupon)) {
            activateSubscriptionWithCongratulations(plan);
        } else {
            // No coupon or invalid coupon - redirect to Facebook page for payment
            window.open('https://www.facebook.com/profile.php?id=61560074175677', '_blank');
        }
    }
    
    function activateSubscriptionWithCongratulations(plan) {
        const couponInput = document.getElementById(`coupon-input-${plan}`);
        const enteredCoupon = couponInput?.value.trim() || '';
        
        if (!enteredCoupon || !validateCoupon(plan, enteredCoupon)) {
            showCouponFeedback(plan, false, translate('subscription.invalidCoupon'));
            playFeedback('error');
            return;
        }
        
        const now = new Date();
        state.subscription.plan = plan;
        state.subscription.activatedAt = now.toISOString();
        
        if (plan === 'pro') {
            const expiresAt = new Date(now);
            expiresAt.setMonth(expiresAt.getMonth() + 1);
            state.subscription.expiresAt = expiresAt.toISOString();
        } else if (plan === 'max' || plan === 'ultra') {
            const expiresAt = new Date(now);
            expiresAt.setFullYear(expiresAt.getFullYear() + 1);
            state.subscription.expiresAt = expiresAt.toISOString();
        }
        
        saveState();
        updateSubscriptionDisplay();
        renderAll();
        showCouponFeedback(plan, true, translate('subscription.activated'));
        couponInput.value = '';
        playFeedback();
        
        // Show congratulations message
        showCongratulationsMessage(plan);
    }
    
    function showCongratulationsMessage(plan) {
        const planNames = {
            pro: translate('subscription.pro') || 'Pro',
            max: translate('subscription.max') || 'Max',
            ultra: translate('subscription.ultra') || 'Ultra Pro'
        };
        
        const planName = planNames[plan] || plan.toUpperCase();
        const isBangla = state.language === 'bn';
        
        const message = isBangla 
            ? `🎉 অভিনন্দন! 🎉\n\nআপনার ${planName} প্ল্যান সফলভাবে সক্রিয় করা হয়েছে!\n\nআপনি এখন সমস্ত প্রিমিয়াম ফিচার ব্যবহার করতে পারবেন।`
            : `🎉 Congratulations! 🎉\n\nYour ${planName} plan has been successfully activated!\n\nYou can now enjoy all premium features.`;
        
        // Create a nice modal-style alert
        const congratsModal = document.createElement('div');
        congratsModal.className = 'congratulations-modal';
        congratsModal.innerHTML = `
            <div class="congratulations-content">
                <div class="congratulations-icon">🎉</div>
                <h2 class="congratulations-title">${isBangla ? 'অভিনন্দন!' : 'Congratulations!'}</h2>
                <p class="congratulations-message">${isBangla 
                    ? `আপনার ${planName} প্ল্যান সফলভাবে সক্রিয় করা হয়েছে!` 
                    : `Your ${planName} plan has been successfully activated!`}</p>
                <p class="congratulations-submessage">${isBangla 
                    ? 'আপনি এখন সমস্ত প্রিমিয়াম ফিচার ব্যবহার করতে পারবেন।' 
                    : 'You can now enjoy all premium features.'}</p>
                <button class="primary-btn congratulations-close-btn">${isBangla ? 'ঠিক আছে' : 'Got it!'}</button>
            </div>
        `;
        
        document.body.appendChild(congratsModal);
        
        // Animate in
        setTimeout(() => {
            congratsModal.classList.add('show');
        }, 10);
        
        // Close button handler
        const closeBtn = congratsModal.querySelector('.congratulations-close-btn');
        const closeModal = () => {
            congratsModal.classList.remove('show');
            setTimeout(() => {
                document.body.removeChild(congratsModal);
            }, 300);
        };
        
        closeBtn.addEventListener('click', closeModal);
        congratsModal.addEventListener('click', (e) => {
            if (e.target === congratsModal) closeModal();
        });
    }

    function updateSubscriptionDisplay() {
        const plan = getSubscriptionPlan();
        if (selectors.currentPlan) {
            let planDisplay = plan.charAt(0).toUpperCase() + plan.slice(1);
            if (plan === 'trial') {
                planDisplay = state.language === 'bn' ? 'ট্রায়াল (৩ দিন)' : 'Trial (3 days)';
            }
            selectors.currentPlan.textContent = planDisplay;
        }
        
        if (selectors.subscriptionExpiry && state.subscription?.expiresAt) {
            const expiry = new Date(state.subscription.expiresAt);
            const expiryStr = expiry.toLocaleDateString(state.language === 'bn' ? 'bn-BD' : 'en-GB');
            const daysLeft = Math.ceil((expiry - new Date()) / (1000 * 60 * 60 * 24));
            if (plan === 'trial' && daysLeft >= 0) {
                selectors.subscriptionExpiry.textContent = state.language === 'bn' 
                    ? `ট্রায়াল শেষ: ${expiryStr} (${daysLeft} দিন বাকি)`
                    : `Trial expires: ${expiryStr} (${daysLeft} days left)`;
            } else {
                selectors.subscriptionExpiry.textContent = `Expires: ${expiryStr}`;
            }
            selectors.subscriptionExpiry.hidden = false;
        } else if (selectors.subscriptionExpiry) {
            selectors.subscriptionExpiry.hidden = true;
        }
    }

    function canUseAI() {
        return checkSubscription() && getSubscriptionPlan() !== 'free';
    }

    function canImportExport() {
        const plan = getSubscriptionPlan();
        return plan === 'pro' || plan === 'max' || plan === 'ultra';
    }

    function canAddCustomer() {
        const plan = getSubscriptionPlan();
        // Trial and paid plans allow unlimited customers
        if (plan === 'trial' || plan === 'pro' || plan === 'max' || plan === 'ultra') return true;
        // Free plan allows up to 5 customers (0-4, so length < 5 means can add)
        // When length is 5, that's the 6th customer, so block it
        return state.customers.length < 5;
    }

    // Notes/Tasks Tab Switching
    function switchNotesTab(tab) {
        state.ui.activeNotesTab = tab;
        saveState();
        
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.tab === tab);
        });
        
        if (selectors.notesSection) {
            selectors.notesSection.hidden = tab !== 'notes';
        }
        if (selectors.tasksSection) {
            selectors.tasksSection.hidden = tab !== 'tasks';
        }
        
        if (tab === 'tasks') {
            renderCalendar();
            renderTaskCards();
        }
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
