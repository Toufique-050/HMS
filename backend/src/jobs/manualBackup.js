import dotenv from "dotenv";
import { spawn } from "node:child_process";
import {
    mkdir,
    mkdtemp,
    writeFile,
    rename,
    rm,
    stat
} from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { fileURLToPath } from "node:url";
import { randomUUID } from "node:crypto";

const backendDirectory = fileURLToPath(
    new URL("../../", import.meta.url)
);

dotenv.config({
    path: path.join(backendDirectory, ".env"),
    quiet: true
});

function runDump(executable, args) {
    return new Promise((resolve, reject) => {
        const child = spawn(executable, args, {
            shell: false,
            windowsHide: true,
            stdio: ["ignore", "ignore", "ignore"]
        });

        let timedOut = false;

        const timer = setTimeout(() => {
            timedOut = true;
            child.kill();
        }, 15 * 60 * 1000);

        child.once("error", error => {
            clearTimeout(timer);

            if (error.code === "ENOENT") {
                reject(new Error(
                    "mongodump nahi mila. MongoDB Database Tools " +
                    "install karein aur bin folder PATH mein add karein."
                ));
                return;
            }

            reject(new Error(
                "mongodump start nahi ho saka. " +
                "Executable path aur permissions check karein."
            ));
        });

        child.once("close", code => {
            clearTimeout(timer);

            if (timedOut) {
                reject(new Error(
                    "Backup 15 minutes mein complete nahi hua."
                ));
                return;
            }

            if (code !== 0) {
                reject(new Error(
                    "Backup fail hua. MongoDB URI, database name, " +
                    "database permissions aur Atlas Network Access " +
                    "check karein."
                ));
                return;
            }

            resolve();
        });
    });
}

async function main() {
    const uri = process.env.MONGODB_URI?.trim();
    const database = process.env.BACKUP_DATABASE?.trim();

    if (!uri) {
        throw new Error("backend/.env mein MONGODB_URI missing hai.");
    }

    if (!database) {
        throw new Error(
            "backend/.env mein BACKUP_DATABASE add karein."
        );
    }

    if (!/^[a-zA-Z0-9_-]+$/.test(database)) {
        throw new Error(
            "BACKUP_DATABASE mein sirf letters, numbers, " +
            "underscore aur hyphen allowed hain."
        );
    }

    const backupDirectory = path.join(
        backendDirectory,
        "storage",
        "backups"
    );

    await mkdir(backupDirectory, {
        recursive: true,
        mode: 0o700
    });

    const temporaryDirectory = await mkdtemp(
        path.join(os.tmpdir(), "luxurystay-backup-")
    );

    const configPath = path.join(
        temporaryDirectory,
        "mongodump.yml"
    );

    const timestamp = new Date()
        .toISOString()
        .replace(/[:.]/g, "-");

    const filename =
        `${database}-${timestamp}-${randomUUID()}.archive.gz`;

    const finalPath = path.join(backupDirectory, filename);
    const partialPath = `${finalPath}.partial`;

    try {
        // Keep credentials out of command-line arguments and logs.
        await writeFile(
            configPath,
            `uri: ${JSON.stringify(uri)}\n`,
            {
                encoding: "utf8",
                mode: 0o600,
                flag: "wx"
            }
        );

        // Create the archive with restrictive permissions.
        await writeFile(partialPath, "", {
            mode: 0o600,
            flag: "wx"
        });

        console.log("Database backup start ho raha hai...");
        console.log("Backup ke dauran app se data changes na karein.");

        await runDump(
            process.env.MONGODUMP_PATH?.trim() || "mongodump",
            [
                `--config=${configPath}`,
                `--db=${database}`,
                `--archive=${partialPath}`,
                "--gzip"
            ]
        );

        const archive = await stat(partialPath);

        if (archive.size === 0) {
            throw new Error("Backup archive empty hai.");
        }

        // Publish the final filename only after successful completion.
        await rename(partialPath, finalPath);

        console.log("Backup successfully save ho gaya.");
        console.log(`File: ${finalPath}`);
        console.log(
            `Size: ${(archive.size / 1024 / 1024).toFixed(2)} MB`
        );
    } finally {
        await rm(partialPath, { force: true });

        await rm(temporaryDirectory, {
            recursive: true,
            force: true
        });
    }
}

main().catch(error => {
    console.error(`Backup error: ${error.message}`);
    process.exitCode = 1;
});