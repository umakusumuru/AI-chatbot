"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ChatController = void 0;
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const rxjs_1 = require("rxjs");
const chat_service_1 = require("./chat.service");
const SendMessageDto_dto_1 = require("./dto/SendMessageDto.dto");
let ChatController = class ChatController {
    constructor(service) {
        this.service = service;
    }
    getHealth() {
        return this.service.getHealth();
    }
    sendMessage(body) {
        return this.service.sendMessage(body);
    }
};
exports.ChatController = ChatController;
__decorate([
    (0, common_1.Get)('health'),
    (0, swagger_1.ApiOperation)({ summary: 'Returns API health status' }),
    (0, swagger_1.ApiResponse)({ status: 200, description: 'Successful response.' }),
    (0, swagger_1.ApiBadRequestResponse)({ description: 'Invalid request.' }),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", rxjs_1.Observable)
], ChatController.prototype, "getHealth", null);
__decorate([
    (0, common_1.Post)('message'),
    (0, swagger_1.ApiOperation)({ summary: 'Sends a chat message and returns a response' }),
    (0, swagger_1.ApiResponse)({ status: 200, description: 'Successful response.' }),
    (0, swagger_1.ApiBadRequestResponse)({ description: 'Invalid request.' }),
    (0, swagger_1.ApiBody)({ type: SendMessageDto_dto_1.SendMessageDto }),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [SendMessageDto_dto_1.SendMessageDto]),
    __metadata("design:returntype", rxjs_1.Observable)
], ChatController.prototype, "sendMessage", null);
exports.ChatController = ChatController = __decorate([
    (0, swagger_1.ApiTags)('chat'),
    (0, common_1.Controller)('chat'),
    __metadata("design:paramtypes", [chat_service_1.ChatService])
], ChatController);
