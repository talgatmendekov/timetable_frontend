// src/data/i18n.js

export const translations = {
  en: {
    // Header
    appTitle: 'University Schedule Builder',
    appSubtitle: 'Timetable Management System',
    guestMode: 'Guest Mode (View Only)',
    logout: 'Logout',

    // Filters
    filterByDay: 'Filter by Day:',
    filterByTeacher: 'Filter by Teacher:',
    filterByGroup: 'Filter by Group:',
    allDays: 'All Days',
    allTeachers: 'All Teachers',
    allGroups: 'All Groups',

    // Days
    Monday: 'Monday',
    Tuesday: 'Tuesday',
    Wednesday: 'Wednesday',
    Thursday: 'Thursday',
    Friday: 'Friday',
    Saturday: 'Saturday',
    today: 'Today',

    // Admin actions
    addGroup: '+ Add Group',
    export: 'Export',
    import: 'Import',
    clearAll: 'Clear All',

    // Modal
    addClass: 'Add Class',
    editClass: 'Edit Class',
    courseName: 'Course Name',
    teacherName: 'Teacher Name',
    roomNumber: 'Room Number',
    courseNameRequired: 'Course name is required',
    save: 'Save',
    cancel: 'Cancel',
    delete: 'Delete',
    confirmDelete: 'Are you sure you want to delete this class?',
    confirmDeleteGroup: 'Are you sure you want to delete group "{group}" and all its classes?',
    confirmClearAll: 'Are you sure you want to clear the entire schedule? This action cannot be undone.',
    enterGroupName: 'Enter new group name (e.g., COMSE-25):',

    // Warnings
    warningTitle: '⚠️ Conflicts Detected',
    teacherConflict: '⚠️ Teacher conflict: {teacher} already has a class at this time',
    roomConflict: '⚠️ Room conflict: {room} is already used at this time',
    teacherConflictIn: 'in {group}',
    roomConflictIn: 'in {group}',
    conflictWarning: 'Save anyway?',

    // Table
    groupTime: 'Group / Time',
    filtered: 'Filtered',

    // Login
    loginTitle: 'University Schedule',
    loginSubtitle: 'Admin Panel',
    username: 'Username',
    password: 'Password',
    loginBtn: 'Login as Admin',
    viewAsGuest: 'View Schedule as Guest',
    loginHint: 'Default: admin / admin123',
    invalidCredentials: 'Invalid credentials',

    // Import/Export
    importSuccess: 'Schedule imported successfully!',
    importFailed: 'Import failed:',

    // Language selector
    language: 'Language',
  },

  ru: {
    // Header
    appTitle: 'Расписание Университета',
    appSubtitle: 'Система Управления Расписанием',
    guestMode: 'Режим Гостя (Только Просмотр)',
    logout: 'Выйти',

    // Filters
    filterByDay: 'Фильтр по Дню:',
    filterByTeacher: 'Фильтр по Преподавателю:',
    filterByGroup: 'Фильтр по Группе:',
    allDays: 'Все Дни',
    allTeachers: 'Все Преподаватели',
    allGroups: 'Все Группы',

    // Days
    Monday: 'Понедельник',
    Tuesday: 'Вторник',
    Wednesday: 'Среда',
    Thursday: 'Четверг',
    Friday: 'Пятница',
    Saturday: 'Суббота',
    today: 'Сегодня',

    // Admin actions
    addGroup: '+ Добавить Группу',
    export: 'Экспорт',
    import: 'Импорт',
    clearAll: 'Очистить Всё',

    // Modal
    addClass: 'Добавить Занятие',
    editClass: 'Редактировать Занятие',
    courseName: 'Название Предмета',
    teacherName: 'Имя Преподавателя',
    roomNumber: 'Номер Аудитории',
    courseNameRequired: 'Название предмета обязательно',
    save: 'Сохранить',
    cancel: 'Отмена',
    delete: 'Удалить',
    confirmDelete: 'Вы уверены, что хотите удалить это занятие?',
    confirmDeleteGroup: 'Вы уверены, что хотите удалить группу "{group}" и все её занятия?',
    confirmClearAll: 'Вы уверены, что хотите очистить всё расписание? Это действие нельзя отменить.',
    enterGroupName: 'Введите название новой группы (например, COMSE-25):',

    // Warnings
    warningTitle: '⚠️ Обнаружены Конфликты',
    teacherConflict: '⚠️ Конфликт преподавателя: {teacher} уже занят в это время',
    roomConflict: '⚠️ Конфликт аудитории: {room} уже занята в это время',
    teacherConflictIn: 'в группе {group}',
    roomConflictIn: 'в группе {group}',
    conflictWarning: 'Сохранить всё равно?',

    // Table
    groupTime: 'Группа / Время',
    filtered: 'Отфильтровано',

    // Login
    loginTitle: 'Расписание Университета',
    loginSubtitle: 'Панель Администратора',
    username: 'Имя пользователя',
    password: 'Пароль',
    loginBtn: 'Войти как Администратор',
    viewAsGuest: 'Просмотр расписания как Гость',
    loginHint: 'По умолчанию: admin / admin123',
    invalidCredentials: 'Неверные данные',

    // Import/Export
    importSuccess: 'Расписание успешно импортировано!',
    importFailed: 'Ошибка импорта:',

    // Language selector
    language: 'Язык',
  },

  ky: {
    // Header
    appTitle: 'Университет Жадыбалы',
    appSubtitle: 'Жадыбалды Башкаруу Системасы',
    guestMode: 'Конок Режими (Жалаң Көрүү)',
    logout: 'Чыгуу',

    // Filters
    filterByDay: 'Күн боюнча:',
    filterByTeacher: 'Мугалим боюнча:',
    filterByGroup: 'Топ боюнча:',
    allDays: 'Бардык Күндөр',
    allTeachers: 'Бардык Мугалимдер',
    allGroups: 'Бардык Топтор',

    // Days
    Monday: 'Дүйшөмбү',
    Tuesday: 'Шейшемби',
    Wednesday: 'Шаршемби',
    Thursday: 'Бейшемби',
    Friday: 'Жума',
    Saturday: 'Ишемби',
    today: 'Бүгүн',

    // Admin actions
    addGroup: '+ Топ Кошуу',
    export: 'Экспорт',
    import: 'Импорт',
    clearAll: 'Баарын Тазалоо',

    // Modal
    addClass: 'Сабак Кошуу',
    editClass: 'Сабакты Өзгөртүү',
    courseName: 'Предметтин Аты',
    teacherName: 'Мугалимдин Аты',
    roomNumber: 'Аудитория Номери',
    courseNameRequired: 'Предметтин аты талап кылынат',
    save: 'Сактоо',
    cancel: 'Жокко чыгаруу',
    delete: 'Жок кылуу',
    confirmDelete: 'Бул сабакты жок кылгыңыз келеби?',
    confirmDeleteGroup: '"{group}" тобун жана анын бардык сабактарын жок кылгыңыз келеби?',
    confirmClearAll: 'Бүткүл жадыбалды тазалагыңыз келеби? Бул аракетти жокко чыгаруу мүмкүн эмес.',
    enterGroupName: 'Жаңы топтун атын киргизиңиз (мис., COMSE-25):',

    // Warnings
    warningTitle: '⚠️ Каршылыктар Аныкталды',
    teacherConflict: '⚠️ Мугалим каршылыгы: {teacher} бул убакта башка сабак берет',
    roomConflict: '⚠️ Аудитория каршылыгы: {room} бул убакта башкага ыйгарылган',
    teacherConflictIn: '{group} тобунда',
    roomConflictIn: '{group} тобунда',
    conflictWarning: 'Дагы эле сактайбызбы?',

    // Table
    groupTime: 'Топ / Убакыт',
    filtered: 'Чыпкаланган',

    // Login
    loginTitle: 'Университет Жадыбалы',
    loginSubtitle: 'Администратор Панели',
    username: 'Колдонуучунун аты',
    password: 'Сырсөз',
    loginBtn: 'Администратор катары кирүү',
    viewAsGuest: 'Конок катары жадыбалды көрүү',
    loginHint: 'Демейки: admin / admin123',
    invalidCredentials: 'Туура эмес маалыматтар',

    // Import/Export
    importSuccess: 'Жадыбал ийгиликтүү импорттолду!',
    importFailed: 'Импорт катасы:',

    // Language selector
    language: 'Тил',
  }
};

export const LANGUAGE_OPTIONS = [
  { code: 'en', label: 'English', flag: '🇬🇧' },
  { code: 'ru', label: 'Русский', flag: '🇷🇺' },
  { code: 'ky', label: 'Кыргызча', flag: '🇰🇬' },
];

// Subject type translations (appended)
// Add these keys to each language object manually, or use the helper below
export const SUBJECT_TYPE_LABELS = {
  en: { lecture: 'Lecture', lab: 'Lab', seminar: 'Seminar', other: 'Other' },
  ru: { lecture: 'Лекция', lab: 'Лабораторная', seminar: 'Семинар', other: 'Другое' },
  ky: { lecture: 'Лекция', lab: 'Лабораториялык', seminar: 'Семинар', other: 'Башка' },
};

export const SUBJECT_TYPES = [
  { value: 'lecture', color: '#2563eb', light: 'rgba(37,99,235,0.13)', icon: '📖' },
  { value: 'lab',     color: '#16a34a', light: 'rgba(22,163,74,0.13)',  icon: '🔬' },
  { value: 'seminar', color: '#ea580c', light: 'rgba(234,88,12,0.13)',  icon: '💬' },
  { value: 'other',   color: '#7c3aed', light: 'rgba(124,58,237,0.13)', icon: '📌' },
];
