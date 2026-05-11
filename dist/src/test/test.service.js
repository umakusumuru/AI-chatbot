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
                email: 'item1@example.com'
            },
            {
                id: '2',
                name: 'Sample Item 2',
                email: 'item2@example.com'
            }
        ]);
    }
    createTestdata(body) {
        const missingFields = ['name', 'email'].filter((key) => !body?.[key]);
        if (missingFields.length) {
            return (0, rxjs_1.throwError)(() => new common_1.BadRequestException(`Missing required field(s): ${missingFields.join(', ')}`));
        }
        return (0, rxjs_1.of)({
            ...body,
            id: Math.random().toString(36).substr(2, 9),
            createdAt: new Date(),
            status: 'success'
        });
    }
    getTestdataById(id) {
        if (id === '0') {
            return (0, rxjs_1.throwError)(() => new common_1.NotFoundException('Resource not found'));
        }
        return (0, rxjs_1.of)({
            id: id,
            name: 'Sample GetTestdataById',
            email: 'sample@example.com'
        });
    }
};
exports.TestService = TestService;
exports.TestService = TestService = __decorate([
    (0, common_1.Injectable)()
], TestService);
