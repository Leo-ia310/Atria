"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.construirLineasAsientoVenta = construirLineasAsientoVenta;
const common_1 = require("@nestjs/common");
function construirLineasAsientoVenta(input) {
    const { grandTotal, taxTotal, paidTotal, cogs, cuentaId } = input;
    const cashApplied = Math.min(paidTotal, grandTotal);
    const receivableAmount = Math.max(grandTotal - cashApplied, 0);
    const netRevenue = grandTotal - taxTotal;
    const lines = [];
    if (cashApplied > 0) {
        lines.push({
            accountId: cuentaId('1101'),
            description: 'Cobro venta',
            debit: cashApplied,
            credit: 0,
        });
    }
    if (receivableAmount > 0) {
        lines.push({
            accountId: cuentaId('1201'),
            description: 'Saldo pendiente por cobrar',
            debit: receivableAmount,
            credit: 0,
        });
    }
    lines.push({
        accountId: cuentaId('4101'),
        description: 'Ingreso por venta',
        debit: 0,
        credit: netRevenue,
    });
    if (taxTotal > 0) {
        lines.push({
            accountId: cuentaId('2102'),
            description: 'IVA débito fiscal',
            debit: 0,
            credit: taxTotal,
        });
    }
    if (cogs > 0) {
        lines.push({
            accountId: cuentaId('5101'),
            description: 'Costo de venta',
            debit: cogs,
            credit: 0,
        });
        lines.push({
            accountId: cuentaId('1301'),
            description: 'Salida de inventario',
            debit: 0,
            credit: cogs,
        });
    }
    const totalDebit = lines.reduce((acc, l) => acc + l.debit, 0);
    const totalCredit = lines.reduce((acc, l) => acc + l.credit, 0);
    if (Math.abs(totalDebit - totalCredit) > 0.0001) {
        throw new common_1.BadRequestException(`Asiento desbalanceado: debe=${totalDebit.toFixed(4)} haber=${totalCredit.toFixed(4)}`);
    }
    return lines;
}
//# sourceMappingURL=pos-accounting.js.map