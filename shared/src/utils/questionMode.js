"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.resolveQuestionMode = resolveQuestionMode;
function resolveQuestionMode(config) {
    return config?.questionMode === 'custom' ? 'custom' : 'competency';
}
//# sourceMappingURL=questionMode.js.map