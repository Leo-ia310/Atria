"use client";
import {DocumentPrintControls} from './DocumentPrintControls';
import {webDocumentCommand} from './WebDocuments';
export function WebInvoiceDocument({contextId,branch,id}:{contextId:string;branch:string;id:string}){return <DocumentPrintControls contextId={contextId} branch={branch} sourceKind="factura" sourceId={id} sourceVersion={1} send={webDocumentCommand}/>;}
