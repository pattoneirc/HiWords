/**
 * 已掌握单词服务
 * 负责处理单词的已掌握状态管理，包括标记、取消标记、状态同步等
 */

import { Notice } from 'obsidian';
import { VocabularyManager } from './vocabulary-manager';
import { t } from '../i18n';
import HiWordsPlugin from '../../main';
import type { WordDefinition } from '../utils';

export class MasteredService {
    private plugin: HiWordsPlugin;
    private vocabularyManager: VocabularyManager;

    constructor(plugin: HiWordsPlugin, vocabularyManager: VocabularyManager) {
        this.plugin = plugin;
        this.vocabularyManager = vocabularyManager;
    }

    updateSettings() {}

    /**
     * 检查已掌握功能是否启用
     */
    get isEnabled(): boolean {
        return this.plugin.settings.enableMasteredFeature;
    }

    /**
     * 标记单词为已掌握
     * @param bookPath 生词本路径
     * @param nodeId 节点 ID
     * @param word 单词文本
     * @returns 操作是否成功
     */
    async markWordAsMastered(bookPath: string, nodeId: string, word: string): Promise<boolean> {
        if (!this.isEnabled) {
            new Notice(t('notices.mastered_feature_disabled'));
            return false;
        }

        try {
            const wordDef = await this.vocabularyManager.getWordDefinitionByNodeId(bookPath, nodeId);
            if (!wordDef?.studyKey) {
                new Notice(t('notices.update_word_status_failed'));
                return false;
            }

            await this.saveStudyProgress(wordDef, true);
            this.vocabularyManager.updateStudyKeyMasteredStatus(wordDef.studyKey, true);
            this.plugin.refreshHighlighter();
            this.plugin.app.workspace.trigger('hi-words:mastered-changed');
            new Notice(t('notices.word_marked_as_mastered').replace('{0}', word));

            return true;
        } catch (error) {
            console.error('标记已掌握失败:', error);
            new Notice(t('notices.mark_mastered_failed'));
            return false;
        }
    }

    /**
     * 取消单词的已掌握标记
     * @param bookPath 生词本路径
     * @param nodeId 节点 ID
     * @param word 单词文本
     * @returns 操作是否成功
     */
    async unmarkWordAsMastered(bookPath: string, nodeId: string, word: string): Promise<boolean> {
        if (!this.isEnabled) {
            new Notice(t('notices.mastered_feature_disabled'));
            return false;
        }

        try {
            const wordDef = await this.vocabularyManager.getWordDefinitionByNodeId(bookPath, nodeId);
            if (!wordDef?.studyKey) {
                new Notice(t('notices.update_word_status_failed'));
                return false;
            }

            await this.saveStudyProgress(wordDef, false);
            this.vocabularyManager.updateStudyKeyMasteredStatus(wordDef.studyKey, false);
            this.plugin.refreshHighlighter();
            this.plugin.app.workspace.trigger('hi-words:mastered-changed');
            new Notice(t('notices.word_unmarked_as_mastered').replace('{0}', word));

            return true;
        } catch (error) {
            console.error('取消已掌握标记失败:', error);
            new Notice(t('notices.unmark_mastered_failed'));
            return false;
        }
    }

    /**
     * 检查单词是否已掌握
     * @param bookPath 生词本路径
     * @param nodeId 节点 ID
     * @returns 是否已掌握
     */
    async isWordMastered(bookPath: string, nodeId: string): Promise<boolean> {
        if (!this.isEnabled) return false;

        try {
            const wordDef = await this.vocabularyManager.getWordDefinitionByNodeId(bookPath, nodeId);
            return wordDef?.mastered === true;
        } catch (error) {
            console.error('检查单词掌握状态失败:', error);
            return false;
        }
    }

    /**
     * 获取已掌握的单词列表
     * @param bookPath 生词本路径（可选，如果不提供则返回所有生词本的已掌握单词）
     * @returns 已掌握的单词定义数组
     */
    async getMasteredWords(bookPath?: string) {
        if (!this.isEnabled) return [];

        try {
            const allWords = await this.vocabularyManager.getAllWordDefinitions();
            
            return allWords.filter(wordDef => {
                // 过滤已掌握的单词
                if (!wordDef.mastered) return false;
                
                // 如果指定了生词本路径，只返回该生词本的单词
                if (bookPath && wordDef.source !== bookPath) return false;
                
                return true;
            });
        } catch (error) {
            console.error('获取已掌握单词列表失败:', error);
            return [];
        }
    }

    /**
     * 获取已掌握单词的统计信息
     * @returns 统计信息对象
     */
    async getMasteredStats() {
        if (!this.isEnabled) {
            return {
                totalMastered: 0,
                totalWords: 0,
                masteredPercentage: 0,
                byBook: {}
            };
        }

        try {
            const allWords = await this.vocabularyManager.getAllWordDefinitions();
            const masteredWords = allWords.filter(w => w.mastered);
            
            // 按生词本分组统计
            const byBook: { [bookPath: string]: { mastered: number, total: number } } = {};
            
            allWords.forEach(word => {
                if (!byBook[word.source]) {
                    byBook[word.source] = { mastered: 0, total: 0 };
                }
                byBook[word.source].total++;
                if (word.mastered) {
                    byBook[word.source].mastered++;
                }
            });

            return {
                totalMastered: masteredWords.length,
                totalWords: allWords.length,
                masteredPercentage: allWords.length > 0 ? (masteredWords.length / allWords.length) * 100 : 0,
                byBook
            };
        } catch (error) {
            console.error('获取已掌握统计信息失败:', error);
            return {
                totalMastered: 0,
                totalWords: 0,
                masteredPercentage: 0,
                byBook: {}
            };
        }
    }

    /**
     * 批量标记多个单词为已掌握
     * @param operations 操作数组，每个操作包含 bookPath, nodeId, word
     * @returns 成功操作的数量
     */
    async batchMarkAsMastered(operations: Array<{ bookPath: string, nodeId: string, word: string }>): Promise<number> {
        if (!this.isEnabled) return 0;

        let successCount = 0;
        
        for (const op of operations) {
            const success = await this.markWordAsMastered(op.bookPath, op.nodeId, op.word);
            if (success) successCount++;
        }

        if (successCount > 0) {
            new Notice(t('notices.batch_marked_success').replace('{0}', successCount.toString()));
        }

        return successCount;
    }

    private async saveStudyProgress(wordDef: WordDefinition | null, mastered: boolean): Promise<void> {
        if (!wordDef?.studyKey) return;

        if (!this.plugin.settings.studyProgress) {
            this.plugin.settings.studyProgress = {};
        }

        if (!mastered) {
            delete this.plugin.settings.studyProgress[wordDef.studyKey];
            await this.plugin.saveSettings();
            return;
        }

        const now = new Date().toISOString();
        this.plugin.settings.studyProgress[wordDef.studyKey] = {
            status: 'mastered',
            masteredAt: this.plugin.settings.studyProgress[wordDef.studyKey]?.masteredAt || now,
            updatedAt: now,
        };
        await this.plugin.saveSettings();
    }

}
