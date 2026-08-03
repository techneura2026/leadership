"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Language = exports.ErrorCode = exports.ReportType = exports.ReadinessRating = exports.CompetencyDomain = exports.RaterRelationship = exports.AssessmentStatus = exports.AssessmentType = exports.Plan = exports.UserRole = void 0;
var UserRole;
(function (UserRole) {
    UserRole["SUPER_ADMIN"] = "super_admin";
    UserRole["ORG_ADMIN"] = "org_admin";
    UserRole["HR_MANAGER"] = "hr_manager";
    UserRole["MANAGER"] = "manager";
    UserRole["PARTICIPANT"] = "participant";
})(UserRole || (exports.UserRole = UserRole = {}));
var Plan;
(function (Plan) {
    Plan["TRIAL"] = "trial";
    Plan["STARTER"] = "starter";
    Plan["PROFESSIONAL"] = "professional";
    Plan["ENTERPRISE"] = "enterprise";
})(Plan || (exports.Plan = Plan = {}));
var AssessmentType;
(function (AssessmentType) {
    AssessmentType["FEEDBACK_360"] = "360_feedback";
    AssessmentType["COMPETENCY"] = "competency";
    AssessmentType["PERSONALITY"] = "personality";
    AssessmentType["READINESS"] = "readiness";
})(AssessmentType || (exports.AssessmentType = AssessmentType = {}));
var AssessmentStatus;
(function (AssessmentStatus) {
    AssessmentStatus["DRAFT"] = "draft";
    AssessmentStatus["ACTIVE"] = "active";
    AssessmentStatus["CLOSED"] = "closed";
    AssessmentStatus["ARCHIVED"] = "archived";
})(AssessmentStatus || (exports.AssessmentStatus = AssessmentStatus = {}));
var RaterRelationship;
(function (RaterRelationship) {
    RaterRelationship["SELF"] = "self";
    RaterRelationship["SUPERVISOR"] = "supervisor";
    RaterRelationship["PEER"] = "peer";
    RaterRelationship["DIRECT_REPORT"] = "direct_report";
    RaterRelationship["STAKEHOLDER"] = "stakeholder";
})(RaterRelationship || (exports.RaterRelationship = RaterRelationship = {}));
var CompetencyDomain;
(function (CompetencyDomain) {
    CompetencyDomain["PEOPLE"] = "people";
    CompetencyDomain["CONCEPTUAL"] = "conceptual";
    CompetencyDomain["BEHAVIOURAL"] = "behavioural";
    CompetencyDomain["TECHNICAL"] = "technical";
})(CompetencyDomain || (exports.CompetencyDomain = CompetencyDomain = {}));
var ReadinessRating;
(function (ReadinessRating) {
    ReadinessRating["READY_NOW"] = "ready_now";
    ReadinessRating["ONE_TWO_YEARS"] = "1_2_years";
    ReadinessRating["DEVELOPING"] = "developing";
    ReadinessRating["NOT_YET_READY"] = "not_yet_ready";
})(ReadinessRating || (exports.ReadinessRating = ReadinessRating = {}));
var ReportType;
(function (ReportType) {
    ReportType["INDIVIDUAL_360"] = "individual_360";
    ReportType["COMPETENCY"] = "competency";
    ReportType["PERSONALITY"] = "personality";
    ReportType["READINESS"] = "readiness";
    ReportType["ORG_SUMMARY"] = "org_summary";
})(ReportType || (exports.ReportType = ReportType = {}));
var ErrorCode;
(function (ErrorCode) {
    ErrorCode["VALIDATION_ERROR"] = "VALIDATION_ERROR";
    ErrorCode["UNAUTHORISED"] = "UNAUTHORISED";
    ErrorCode["FORBIDDEN"] = "FORBIDDEN";
    ErrorCode["NOT_FOUND"] = "NOT_FOUND";
    ErrorCode["CONFLICT"] = "CONFLICT";
    ErrorCode["PLAN_LIMIT_EXCEEDED"] = "PLAN_LIMIT_EXCEEDED";
    ErrorCode["ASSESSMENT_CLOSED"] = "ASSESSMENT_CLOSED";
    ErrorCode["RATER_TOKEN_INVALID"] = "RATER_TOKEN_INVALID";
    ErrorCode["RATER_TOKEN_EXPIRED"] = "RATER_TOKEN_EXPIRED";
    ErrorCode["ANONYMITY_THRESHOLD_NOT_MET"] = "ANONYMITY_THRESHOLD_NOT_MET";
    ErrorCode["ORG_INACTIVE"] = "ORG_INACTIVE";
    ErrorCode["TRIAL_EXPIRED"] = "TRIAL_EXPIRED";
    ErrorCode["RATE_LIMIT_EXCEEDED"] = "RATE_LIMIT_EXCEEDED";
})(ErrorCode || (exports.ErrorCode = ErrorCode = {}));
var Language;
(function (Language) {
    Language["EN"] = "en";
    Language["SI"] = "si";
    Language["TA"] = "ta";
})(Language || (exports.Language = Language = {}));
//# sourceMappingURL=index.js.map