"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.TestService = void 0;
const common_1 = require("@nestjs/common");
const rxjs_1 = require("rxjs");
let TestService = class TestService {
    getAlltestdata() {
        return (0, rxjs_1.of)([
            {
                id: '1',
                name: 'Sample Item 1',
                createdAt: new Date()
            },
            {
                id: '2',
                name: 'Sample Item 2',
                createdAt: new Date()
            }
        ]);
    }
    createTestdata(body) {
        return (0, rxjs_1.of)({
            ...body,
            id: Math.random().toString(36).substr(2, 9),
            createdAt: new Date(),
            status: 'success'
        });
    }
    getTestdataById() {
        return (0, rxjs_1.of)({
            id: '1',
            name: 'Sample GetTestdataById',
            status: 'active',
            createdAt: new Date()
        });
    }
};
exports.TestService = TestService;
exports.TestService = TestService = __decorate([
    (0, common_1.Injectable)()
], TestService);
