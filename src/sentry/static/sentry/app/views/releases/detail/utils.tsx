import {Location} from 'history';
import pick from 'lodash/pick';
import {browserHistory} from 'react-router';

import {Client} from 'app/api';
import {
  CommitFile,
  Commit,
  FilesByRepository,
  Repository,
  ReleaseStatus,
} from 'app/types';
import {t} from 'app/locale';
import {URL_PARAM} from 'app/constants/globalSelectionHeader';
import {
  addErrorMessage,
  addLoadingMessage,
  addSuccessMessage,
} from 'app/actionCreators/indicator';

export type CommitsByRepository = {
  [key: string]: Commit[];
};

export const archiveRelease = async (orgId: string, version: string) => {
  const api = new Client();
  addLoadingMessage(t('Archiving Release...'));
  try {
    await api.requestPromise(`/organizations/${orgId}/releases/`, {
      method: 'POST',
      data: {
        status: ReleaseStatus.Archived,
        projects: [],
        version,
      },
    });

    addSuccessMessage(t('Release was successfully archived.'));
    browserHistory.push(`/organizations/${orgId}/releases/`);
  } catch (error) {
    const errorMessage =
      error.responseJSON?.detail ?? t('Release could not be be archived.');
    addErrorMessage(errorMessage);
  }
};

export const restoreRelease = async (
  orgId: string,
  version: string,
  onSuccess?: () => void
) => {
  const api = new Client();
  addLoadingMessage(t('Restoring Release...'));
  try {
    await api.requestPromise(`/organizations/${orgId}/releases/`, {
      method: 'POST',
      data: {
        status: ReleaseStatus.Active,
        projects: [],
        version,
      },
    });
    addSuccessMessage(t('Release was successfully restored.'));
    onSuccess?.();
  } catch (error) {
    const errorMessage =
      error.responseJSON?.detail ?? t('Release could not be be archived.');
    addErrorMessage(errorMessage);
  }
};

/**
 * Convert list of individual file changes into a per-file summary grouped by repository
 */
export function getFilesByRepository(fileList: CommitFile[]) {
  return fileList.reduce<FilesByRepository>((filesByRepository, file) => {
    const {filename, repoName, author, type} = file;

    if (!filesByRepository.hasOwnProperty(repoName)) {
      filesByRepository[repoName] = {};
    }

    if (!filesByRepository[repoName].hasOwnProperty(filename)) {
      filesByRepository[repoName][filename] = {
        authors: {},
        types: new Set(),
      };
    }

    if (author.email) {
      filesByRepository[repoName][filename].authors[author.email] = author;
    }

    filesByRepository[repoName][filename].types.add(type);

    return filesByRepository;
  }, {});
}

/**
 * Convert list of individual commits into a summary grouped by repository
 */
export function getCommitsByRepository(commitList: Commit[]): CommitsByRepository {
  return commitList.reduce((commitsByRepository, commit) => {
    const repositoryName = commit.repository?.name ?? t('unknown');

    if (!commitsByRepository.hasOwnProperty(repositoryName)) {
      commitsByRepository[repositoryName] = [];
    }

    commitsByRepository[repositoryName].push(commit);

    return commitsByRepository;
  }, {});
}

/**
 * Get request query according to the url params and active repository
 */

type GetQueryProps = {
  location: Location;
  perPage?: number;
  activeRepository?: Repository;
};

export function getQuery({location, perPage = 40, activeRepository}: GetQueryProps) {
  const query = {
    ...pick(location.query, [...Object.values(URL_PARAM), 'cursor']),
    per_page: perPage,
  };

  if (!activeRepository) {
    return query;
  }

  return {...query, repo_name: activeRepository.name};
}

/**
 * Get repositories to render according to the activeRepository
 */
export function getReposToRender(repos: Array<string>, activeRepository?: Repository) {
  if (!activeRepository) {
    return repos;
  }
  return [activeRepository.name];
}
