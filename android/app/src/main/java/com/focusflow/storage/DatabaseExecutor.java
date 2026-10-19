package com.focusflow.storage;

import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

public class DatabaseExecutor {
    private static DatabaseExecutor instance;
    private final ExecutorService executorService;

    private DatabaseExecutor() {
        this.executorService = Executors.newSingleThreadExecutor();
    }

    public static synchronized DatabaseExecutor getInstance() {
        if (instance == null) {
            instance = new DatabaseExecutor();
        }
        return instance;
    }

    public void execute(Runnable command) {
        executorService.execute(command);
    }
}
