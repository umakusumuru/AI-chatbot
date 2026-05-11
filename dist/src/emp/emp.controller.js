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
exports.EmpController = void 0;
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const rxjs_1 = require("rxjs");
const emp_service_1 = require("./emp.service");
const CreateEmpDto_dto_1 = require("./dto/CreateEmpDto.dto");
let EmpController = class EmpController {
    constructor(service) {
        this.service = service;
    }
    getEmpdetails() {
        return this.service.getEmpdetails();
    }
    createEmp(body) {
        return this.service.createEmp(body);
    }
    getEmpById(id) {
        return this.service.getEmpById(id);
    }
};
exports.EmpController = EmpController;
__decorate([
    (0, common_1.Get)(''),
    (0, swagger_1.ApiOperation)({ summary: 'Fetch all employees' }),
    (0, swagger_1.ApiResponse)({ status: 200, description: 'Successful response.' }),
    (0, swagger_1.ApiBadRequestResponse)({ description: 'Invalid request.' }),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", rxjs_1.Observable)
], EmpController.prototype, "getEmpdetails", null);
__decorate([
    (0, common_1.Post)('create'),
    (0, swagger_1.ApiOperation)({ summary: 'Create a new employee' }),
    (0, swagger_1.ApiResponse)({ status: 200, description: 'Successful response.' }),
    (0, swagger_1.ApiBadRequestResponse)({ description: 'Invalid request.' }),
    (0, swagger_1.ApiBody)({ type: CreateEmpDto_dto_1.CreateEmpDto }),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [CreateEmpDto_dto_1.CreateEmpDto]),
    __metadata("design:returntype", rxjs_1.Observable)
], EmpController.prototype, "createEmp", null);
__decorate([
    (0, common_1.Get)(':id'),
    (0, swagger_1.ApiOperation)({ summary: 'Get employee by ID' }),
    (0, swagger_1.ApiResponse)({ status: 200, description: 'Successful response.' }),
    (0, swagger_1.ApiBadRequestResponse)({ description: 'Invalid request.' }),
    (0, swagger_1.ApiNotFoundResponse)({ description: 'Resource not found.' }),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", rxjs_1.Observable)
], EmpController.prototype, "getEmpById", null);
exports.EmpController = EmpController = __decorate([
    (0, swagger_1.ApiTags)('emp'),
    (0, common_1.Controller)('emp'),
    __metadata("design:paramtypes", [emp_service_1.EmpService])
], EmpController);
