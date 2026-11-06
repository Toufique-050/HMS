import test from "node:test";
import assert from "node:assert/strict";

import {
    CHECKLIST,
    canReadTask,
    canWorkIssue,
    requireTransition,
    requireChecklist,
    nextCleaningState
} from "../housekeeping/policy.js";

import {
    cleaningUpdate,
    reportIssue,
    issueUpdate
} from "../housekeeping/validators.js";
test('own hotel and assignment are required',()=>{const a={_id:'s',hotelId:'h'};assert.equal(canReadTask({assignedTo:'s',hotelId:'h'},a),true);assert.equal(canReadTask({assignedTo:'x',hotelId:'h'},a),false);assert.equal(canReadTask({assignedTo:'s',hotelId:'x'},a),false);assert.equal(canWorkIssue({reportedBy:'s',assignedTo:'x',hotelId:'h'},a),false);});
test('cannot skip start or reopen completed work',()=>{requireTransition('pending','in_progress');requireTransition('in_progress','completed');assert.throws(()=>requireTransition('pending','completed'));assert.throws(()=>requireTransition('completed','in_progress'));});
test('all checklist items are mandatory',()=>{const c=Object.fromEntries(CHECKLIST.map(([k])=>[k,true]));requireChecklist(c);assert.throws(()=>requireChecklist({...c,bins:false}));assert.equal(cleaningUpdate.safeParse({status:'completed',checklist:c}).success,true);assert.equal(cleaningUpdate.safeParse({status:'completed',checklist:{...c,bins:'true'}}).success,false);});
test('other unfinished tasks prevent room readiness',()=>{assert.equal(nextCleaningState([]),'clean');assert.equal(nextCleaningState([{status:'pending'}]),'dirty');assert.equal(nextCleaningState([{status:'in_progress'}]),'cleaning');});
test('cannot inject assignment, hotel or final resolution',()=>{assert.equal(cleaningUpdate.safeParse({status:'in_progress',assignedTo:'x'}).success,false);assert.equal(reportIssue.safeParse({roomId:'a'.repeat(24),issue:'Leak',priority:'high',hotelId:'x'}).success,false);assert.equal(issueUpdate.safeParse({action:'resolve'}).success,false);assert.equal(issueUpdate.safeParse({action:'work-note',workNotes:' '}).success,false);});
