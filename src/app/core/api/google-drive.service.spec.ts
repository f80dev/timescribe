import { TestBed } from '@angular/core/testing';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { GoogleDriveService } from './google-drive.service';

interface GapiDriveMock {
  files: {
    list: ReturnType<typeof vi.fn>;
    get: ReturnType<typeof vi.fn>;
  };
}

function installDriveMock(): GapiDriveMock {
  const drive: GapiDriveMock = {
    files: {
      list: vi.fn().mockResolvedValue({
        result: {
          files: [
            {
              id: 'file-1',
              name: 'note.txt',
              mimeType: 'text/plain',
              size: '1024',
              modifiedTime: '2026-09-10T10:00:00Z',
            },
            {
              id: 'file-2',
              name: 'spec.pdf',
              mimeType: 'application/pdf',
              size: '51200',
              modifiedTime: '2026-09-11T10:00:00Z',
            },
          ],
          nextPageToken: 'token-2',
        },
      }),
      get: vi.fn().mockResolvedValue({
        body: 'Contenu texte du fichier\nLigne 2',
        result: {
          id: 'file-1',
          name: 'note.txt',
          mimeType: 'text/plain',
        },
      }),
    },
  };
  const gapi = {
    client: {
      drive,
      setToken: vi.fn(),
    },
  };
  (window as any).gapi = gapi;
  return drive;
}

describe('GoogleDriveService', () => {
  let drive: GapiDriveMock;

  beforeEach(() => {
    drive = installDriveMock();
    TestBed.configureTestingModule({});
  });

  afterEach(() => {
    delete (window as any).gapi;
  });

  it('listFiles() appelle files.list avec q="folderId in parents"', async () => {
    const svc = TestBed.inject(GoogleDriveService);
    await svc.listFiles('folder-A');
    expect(drive.files.list).toHaveBeenCalledWith(
      expect.objectContaining({
        q: expect.stringContaining("'folder-A' in parents"),
      }),
    );
  });

  it('listFiles() filtre par MIME si fourni', async () => {
    const svc = TestBed.inject(GoogleDriveService);
    await svc.listFiles('folder-A', ['text/plain', 'application/pdf']);
    expect(drive.files.list).toHaveBeenCalledWith(
      expect.objectContaining({
        q: expect.stringMatching(/mimeType='text\/plain'.*or.*mimeType='application\/pdf'/),
      }),
    );
  });

  it('listFiles() retourne le nextPageToken pour pagination', async () => {
    const svc = TestBed.inject(GoogleDriveService);
    const page = await svc.listFiles('folder-A');
    expect(page.files.length).toBe(2);
    expect(page.nextPageToken).toBe('token-2');
  });

  it('listFiles() passe pageToken si fourni', async () => {
    const svc = TestBed.inject(GoogleDriveService);
    await svc.listFiles('folder-A', undefined, 'token-1');
    expect(drive.files.list).toHaveBeenCalledWith(
      expect.objectContaining({ pageToken: 'token-1' }),
    );
  });

  it('getFileText() retourne le contenu brut pour un fichier texte', async () => {
    const svc = TestBed.inject(GoogleDriveService);
    const text = await svc.getFileText('file-1');
    expect(text).toContain('Contenu texte');
  });

  it('computeContentHash() retourne un sha256 hexadécimal 64 chars', async () => {
    const svc = TestBed.inject(GoogleDriveService);
    const hash = await svc.computeContentHash('hello world');
    expect(hash).toMatch(/^[a-f0-9]{64}$/);
    // Deterministic
    const hash2 = await svc.computeContentHash('hello world');
    expect(hash).toBe(hash2);
    // Different content → different hash
    const hash3 = await svc.computeContentHash('hello WORLD');
    expect(hash3).not.toBe(hash);
  });
});