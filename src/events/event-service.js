import { normalizeRecurrenceId } from './event-normalizer.js';

export const buildEventServiceData = (calendarId, eventData) => {
  const baseData = {
    entity_id: calendarId,
    summary: eventData.summary
  };

  if (eventData.location) {
    baseData.location = eventData.location;
  }

  if (eventData.description) {
    baseData.description = eventData.description;
  }

  if (eventData.start.date) {
    baseData.start_date = eventData.start.date;
    baseData.end_date = eventData.end.date;
  } else {
    baseData.start_date_time = eventData.start.dateTime;
    baseData.end_date_time = eventData.end.dateTime;
  }

  if (eventData.rrule) {
    baseData.rrule = eventData.rrule;
  }

  return baseData;
};

export const buildCreateEventWebSocketPayload = (calendarId, eventData) => ({
  type: 'calendar/event/create',
  entity_id: calendarId,
  event: {
    summary: eventData.summary,
    location: eventData.location,
    description: eventData.description,
    rrule: eventData.rrule,
    dtstart: eventData.start.dateTime || eventData.start.date,
    dtend: eventData.end.dateTime || eventData.end.date
  }
});

export const getRecurringUpdateControls = (originalEvent, eventData, editScope = 'this') => {
  const isRecurringUpdate = !!eventData.rrule || !!originalEvent.rrule;
  return {
    isRecurringUpdate,
    recurrenceId: (isRecurringUpdate && editScope !== 'all') ? normalizeRecurrenceId(originalEvent.recurrence_id) : null,
    recurrenceRange: (isRecurringUpdate && editScope === 'future' && originalEvent.recurrence_id) ? 'THISANDFUTURE' : null
  };
};

export const buildUpdateEventServiceData = (originalEvent, eventData, recurrenceId = null, recurrenceRange = null) => {
  const serviceData = {
    ...buildEventServiceData(originalEvent.entityId, eventData),
    uid: originalEvent.uid
  };

  const normalizedRecurrenceId = normalizeRecurrenceId(recurrenceId);
  if (normalizedRecurrenceId) {
    serviceData.recurrence_id = normalizedRecurrenceId;
  }

  if (recurrenceRange) {
    serviceData.recurrence_range = recurrenceRange;
  }

  return serviceData;
};

export const buildUpdateEventWebSocketPayload = (originalEvent, eventData, recurrenceId = null, recurrenceRange = null) => {
  const dtstart = eventData.start.dateTime || eventData.start.date;
  const dtend = eventData.end.dateTime || eventData.end.date;

  const eventPayload = {
    summary: eventData.summary,
    dtstart,
    dtend
  };

  if (eventData.location) {
    eventPayload.location = eventData.location;
  }

  if (eventData.description) {
    eventPayload.description = eventData.description;
  }

  if (eventData.rrule) {
    eventPayload.rrule = eventData.rrule;
  }

  const wsPayload = {
    type: 'calendar/event/update',
    entity_id: originalEvent.entityId,
    uid: originalEvent.uid,
    event: eventPayload
  };

  const normalizedRecurrenceId = normalizeRecurrenceId(recurrenceId);
  if (normalizedRecurrenceId) {
    wsPayload.recurrence_id = normalizedRecurrenceId;
  }

  if (recurrenceRange) {
    wsPayload.recurrence_range = recurrenceRange;
  }

  return wsPayload;
};

export const buildDeleteEventPayload = (calendarId, uid, recurrenceId = null, recurrenceRange = null) => {
  const payload = {
    entity_id: calendarId,
    uid: uid
  };

  const normalizedRecurrenceId = normalizeRecurrenceId(recurrenceId);
  if (normalizedRecurrenceId) {
    payload.recurrence_id = normalizedRecurrenceId;
  }

  if (recurrenceRange) {
    payload.recurrence_range = recurrenceRange;
  }

  return payload;
};

export const buildDeleteEventWebSocketPayload = (calendarId, uid, recurrenceId = null, recurrenceRange = null) => ({
  type: 'calendar/event/delete',
  ...buildDeleteEventPayload(calendarId, uid, recurrenceId, recurrenceRange)
});

// Home Assistant error codes that mean the request was rejected before the calendar changed
// anything, so replacing the event with create+delete cannot duplicate it or lose its UID.
// Anything else (connection lost, timeout, an integration error) leaves the outcome unknown.
const DEFINITIVE_REJECTION_CODES = new Set([
  'unknown_command',
  'not_supported',
  'not_found',
  'invalid_format',
  'service_validation_error'
]);

export const isDefinitiveUpdateRejection = (error) => DEFINITIVE_REJECTION_CODES.has(error?.code);

// A calendar.update_event service is only usable when it declares every field the card sends.
// Integrations such as Spook register the same service name with a different schema.
export const isCompatibleUpdateEventService = (service, serviceData) => {
  const fields = service?.fields;
  if (!fields || typeof fields !== 'object') {
    return false;
  }
  return Object.keys(serviceData).every((key) => key === 'entity_id' || key in fields);
};
