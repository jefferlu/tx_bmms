import { Pipe, PipeTransform } from '@angular/core';

@Pipe({
    name: 'gtsMapByName',
    standalone: true
})
export class GtsMapByName implements PipeTransform {

    transform(values: any[]): any {
        if (!values) return values;        
        return values.map(e => e.name).join(' | ');
    }
}
