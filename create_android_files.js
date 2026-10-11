const fs = require('fs');

const generateJavaClass = (pkg, name, imports = '') => `package ${pkg};\n\n${imports}\npublic class ${name} {\n    // TODO: implement\n}\n`;

const pkgBase = 'com.focusflow';
const javaBase = 'android/app/src/main/java/com/focusflow';

const files = {};

// Bridge
files[javaBase + '/bridge/FocusFlowPackage.java'] = generateJavaClass(pkgBase + '.bridge', 'FocusFlowPackage');
files[javaBase + '/bridge/TrackingModule.java'] = generateJavaClass(pkgBase + '.bridge', 'TrackingModule');
files[javaBase + '/bridge/StorageModule.java'] = generateJavaClass(pkgBase + '.bridge', 'StorageModule');
files[javaBase + '/bridge/ReminderModule.java'] = generateJavaClass(pkgBase + '.bridge', 'ReminderModule');
files[javaBase + '/bridge/PermissionModule.java'] = generateJavaClass(pkgBase + '.bridge', 'PermissionModule');
files[javaBase + '/bridge/FocusModule.java'] = generateJavaClass(pkgBase + '.bridge', 'FocusModule');
files[javaBase + '/bridge/BackupModule.java'] = generateJavaClass(pkgBase + '.bridge', 'BackupModule');

// Tracking
files[javaBase + '/tracking/UsageCollector.java'] = generateJavaClass(pkgBase + '.tracking', 'UsageCollector');
files[javaBase + '/tracking/UnlockCounter.java'] = generateJavaClass(pkgBase + '.tracking', 'UnlockCounter');
files[javaBase + '/tracking/NotificationCounterService.java'] = generateJavaClass(pkgBase + '.tracking', 'NotificationCounterService');
files[javaBase + '/tracking/DailyAggregator.java'] = generateJavaClass(pkgBase + '.tracking', 'DailyAggregator');

// Focus
files[javaBase + '/focus/FocusSessionManager.java'] = generateJavaClass(pkgBase + '.focus', 'FocusSessionManager');

// Reminders
files[javaBase + '/reminders/ReminderScheduler.java'] = generateJavaClass(pkgBase + '.reminders', 'ReminderScheduler');
files[javaBase + '/reminders/ReminderReceiver.java'] = generateJavaClass(pkgBase + '.reminders', 'ReminderReceiver');
files[javaBase + '/reminders/NotificationChannels.java'] = generateJavaClass(pkgBase + '.reminders', 'NotificationChannels');

// Permissions
files[javaBase + '/permissions/PermissionHelper.java'] = generateJavaClass(pkgBase + '.permissions', 'PermissionHelper');

// Storage
files[javaBase + '/storage/DatabaseHelper.java'] = generateJavaClass(pkgBase + '.storage', 'DatabaseHelper');
files[javaBase + '/storage/DatabaseSchema.java'] = generateJavaClass(pkgBase + '.storage', 'DatabaseSchema');
files[javaBase + '/storage/DatabaseExecutor.java'] = generateJavaClass(pkgBase + '.storage', 'DatabaseExecutor');
files[javaBase + '/storage/migrations/MigrationRunner.java'] = generateJavaClass(pkgBase + '.storage.migrations', 'MigrationRunner');

// Storage DAO
files[javaBase + '/storage/dao/UsageDao.java'] = generateJavaClass(pkgBase + '.storage.dao', 'UsageDao');
files[javaBase + '/storage/dao/UnlockDao.java'] = generateJavaClass(pkgBase + '.storage.dao', 'UnlockDao');
files[javaBase + '/storage/dao/NotificationDao.java'] = generateJavaClass(pkgBase + '.storage.dao', 'NotificationDao');
files[javaBase + '/storage/dao/FocusSessionDao.java'] = generateJavaClass(pkgBase + '.storage.dao', 'FocusSessionDao');
files[javaBase + '/storage/dao/CalendarEventDao.java'] = generateJavaClass(pkgBase + '.storage.dao', 'CalendarEventDao');
files[javaBase + '/storage/dao/ReminderDao.java'] = generateJavaClass(pkgBase + '.storage.dao', 'ReminderDao');
files[javaBase + '/storage/dao/AppLimitDao.java'] = generateJavaClass(pkgBase + '.storage.dao', 'AppLimitDao');
files[javaBase + '/storage/dao/SettingsDao.java'] = generateJavaClass(pkgBase + '.storage.dao', 'SettingsDao');

// Backup
files[javaBase + '/backup/BackupManager.java'] = generateJavaClass(pkgBase + '.backup', 'BackupManager');
files[javaBase + '/backup/BackupValidator.java'] = generateJavaClass(pkgBase + '.backup', 'BackupValidator');

// Workers
files[javaBase + '/workers/UsageCollectionWorker.java'] = generateJavaClass(pkgBase + '.workers', 'UsageCollectionWorker');
files[javaBase + '/workers/DataCleanupWorker.java'] = generateJavaClass(pkgBase + '.workers', 'DataCleanupWorker');

// Receivers
files[javaBase + '/receivers/RescheduleReceiver.java'] = generateJavaClass(pkgBase + '.receivers', 'RescheduleReceiver');

Object.keys(files).forEach((path) => {
    if (!fs.existsSync(path)) {
        fs.writeFileSync(path, files[path], 'utf8');
    }
});

console.log('Successfully created all Android Java scaffolding files.');
